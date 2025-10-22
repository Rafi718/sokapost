import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Sleep helper for retry delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Check if it's a 503 or rate limit error
      const is503 = error.status === 503 || error.message?.includes('overloaded') || error.message?.includes('503')
      const isRateLimit = error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('429')
      
      // Only retry on 503 or rate limit errors
      if (!is503 && !isRateLimit) {
        throw error
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`⏳ AI overloaded, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`)
      await sleep(delay)
    }
  }
  
  // All retries failed
  throw lastError
}

export interface GenerateContentParams {
  topic: string
  tone: string // casual, formal, funny, professional
  language: string // id, en
  maxLength: number
  includeHashtags: boolean
  customPrompt?: string | null
  platform: string // threads, instagram
}

function getDefaultSystemPrompt(tone: string, language: string): string {
  const toneMap: Record<string, string> = {
    casual: language === 'id' ? 'santai dan friendly' : 'casual and friendly',
    formal: language === 'id' ? 'formal dan profesional' : 'formal and professional',
    funny: language === 'id' ? 'lucu dan menghibur' : 'funny and entertaining',
    professional: language === 'id' ? 'profesional dan informatif' : 'professional and informative'
  }

  if (language === 'id') {
    return `Kamu adalah seorang content creator yang ahli dalam membuat konten social media yang engaging.
Tulis dengan gaya ${toneMap[tone] || 'casual dan friendly'}.
Buat konten yang menarik, informatif, dan mudah dipahami.
PENTING: Jangan tambahkan penjelasan atau komentar, langsung tulis konten postnya saja.`
  } else {
    return `You are an expert social media content creator who creates engaging content.
Write in a ${toneMap[tone] || 'casual and friendly'} tone.
Create attractive, informative, and easy-to-understand content.
IMPORTANT: Don't add explanations or comments, write only the post content.`
  }
}

function buildUserPrompt(params: GenerateContentParams): string {
  const { topic, maxLength, includeHashtags, language, platform } = params
  
  let prompt = ''
  
  if (language === 'id') {
    prompt = `Buat konten social media tentang "${topic}" untuk platform ${platform}.

Syarat:
- Maksimal ${maxLength} karakter
- ${includeHashtags ? 'Sertakan 3-5 hashtag yang relevan' : 'Tidak perlu hashtag'}
- Engaging dan menarik perhatian
- Sesuai dengan platform ${platform}
- Tulis dalam bahasa Indonesia

Tulis HANYA konten post-nya, tanpa penjelasan tambahan!`
  } else {
    prompt = `Create social media content about "${topic}" for ${platform}.

Requirements:
- Maximum ${maxLength} characters
- ${includeHashtags ? 'Include 3-5 relevant hashtags' : 'No hashtags needed'}
- Engaging and attention-grabbing
- Platform-appropriate for ${platform}
- Write in English

Write ONLY the post content, no additional explanations!`
  }

  return prompt
}

export async function generateContent(params: GenerateContentParams): Promise<string> {
  const { tone, language, customPrompt } = params

  // Get system prompt (custom or default)
  const systemPrompt = customPrompt || getDefaultSystemPrompt(tone, language)
  
  // Build user prompt
  const userPrompt = buildUserPrompt(params)

  console.log('🤖 Generating AI content...')
  console.log('Topic:', params.topic)
  console.log('Tone:', tone)
  console.log('Platform:', params.platform)

  try {
    // Try multiple models in order of preference
    const models = [
      'gemini-2.5-flash-lite',   // Primary (newest, fastest)
      'gemini-2.0-flash-lite',   // Fallback 1
      'gemini-1.5-flash-latest', // Fallback 2
      'gemini-1.5-pro-latest'    // Fallback 3
    ]
    
    const modelName = process.env.GEMINI_MODEL || models[0]
    
    let result
    let lastError
    
    // Try each model until one works
    for (const tryModel of [modelName, ...models.filter(m => m !== modelName)]) {
      try {
        console.log(`🔄 Trying model: ${tryModel}`)
        const model = genAI.getGenerativeModel({ 
          model: tryModel,
          systemInstruction: systemPrompt
        })

        // Generate with retry logic
        result = await retryWithBackoff(
          () => model.generateContent(userPrompt),
          2, // Reduce retries per model
          1000
        )
        
        console.log(`✅ Success with model: ${tryModel}`)
        break // Success, exit loop
      } catch (error: any) {
        lastError = error
        console.log(`❌ Model ${tryModel} failed: ${error.message}`)
        
        // If it's quota error, try next model
        if (error.status === 429 || error.message?.includes('quota')) {
          continue
        }
        // For other errors, throw immediately
        throw error
      }
    }
    
    // If all models failed, throw the last error
    if (!result) {
      throw lastError || new Error('All models failed')
    }
    
    const response = await result.response
    let text = response.text().trim()

    // Remove common prefixes that AI might add
    const prefixesToRemove = [
      /^Okay,?\s+here'?s?.*?:\s*/i,
      /^Here'?s?\s+.*?:\s*/i,
      /^Berikut\s+.*?:\s*/i,
      /^Ini\s+dia\s+.*?:\s*/i,
      /^Oke,?\s+.*?:\s*/i,
      /^Baik,?\s+.*?:\s*/i,
      /^Sure,?\s+.*?:\s*/i,
      /^Post:\s*/i,
      /^Caption:\s*/i,
      /^Content:\s*/i,
    ]

    for (const prefix of prefixesToRemove) {
      text = text.replace(prefix, '')
    }

    // Remove quotes if AI wraps content in quotes
    text = text.replace(/^["']|["']$/g, '')

    // Ensure max length
    if (text.length > params.maxLength) {
      text = text.substring(0, params.maxLength - 3) + '...'
    }

    console.log('✅ Content generated:', text.substring(0, 100) + (text.length > 100 ? '...' : ''))
    return text.trim()
  } catch (error: any) {
    console.error('❌ AI content generation error:', error)
    
    // User-friendly error messages
    let errorMessage = 'Failed to generate content'
    
    if (error.status === 503 || error.message?.includes('overloaded')) {
      errorMessage = 'AI service is currently overloaded. Please try again later.'
    } else if (error.status === 429 || error.message?.includes('quota')) {
      errorMessage = 'Daily quota exceeded. Please try again tomorrow or use a different API key.'
    } else if (error.status === 404 || error.message?.includes('not found')) {
      errorMessage = 'AI model not available. Please check your configuration.'
    } else if (error.message?.includes('API key')) {
      errorMessage = 'Invalid API key. Please check your GEMINI_API_KEY in .env file.'
    } else if (error.message?.includes('All models failed')) {
      errorMessage = 'All AI models are unavailable. Daily quota may be exceeded.'
    }
    
    throw new Error(errorMessage)
  }
}
