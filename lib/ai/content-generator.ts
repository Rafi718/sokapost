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
  customPrompt: string // Detailed instruction to AI (REQUIRED)
  tone: string // casual, formal, funny, professional
  language: string // id, en
  maxLength: number
  includeHashtags: boolean
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
    return `Kamu adalah copywriter profesional yang ahli dalam membuat konten social media yang converting menggunakan framework SLAP (Stop, Look, Act, Purchase).

FRAMEWORK SLAP:
1. STOP - Buat opening yang menghentikan scroll (hook yang kuat, pertanyaan provokatif, atau statement mengejutkan)
2. LOOK - Bangun interest dan curiosity (fakta menarik, pain point, atau benefit yang relatable)
3. ACT - Dorong desire dan action (solusi konkret, tips actionable, atau value proposition)
4. PURCHASE - Closing yang persuasive (CTA yang jelas atau engagement hook)

GAYA PENULISAN:
- Tone: ${toneMap[tone] || 'casual dan friendly'}
- Tulis seperti MANUSIA berbicara, bukan AI atau robot
- Bahasa natural, conversational, dan authentic
- Gunakan storytelling yang engaging dan relatable
- Bullet points atau numbered list untuk readability
- MINIMAL emoji (maksimal 1-2 saja, atau tidak sama sekali)
- Hindari buzzword klise seperti "game-changer", "unlock", "dive in", "level up"
- Fokus pada benefit konkret, bukan feature teknis
- Personal dan genuine, bukan sales-y atau pushy

FORMAT:
- Opening hook yang KUAT dan NATURAL (1-2 kalimat)
- Body yang valuable dan actionable
- Closing dengan CTA atau pertanyaan engaging
- JANGAN gunakan markdown formatting (* ** ___ untuk bold/italic)
- Gunakan PLAIN TEXT saja tanpa formatting special
- Untuk emphasis, gunakan kapitalisasi atau line break, BUKAN asterisk

PENTING: 
- Tulis HANYA konten postnya, tanpa label "STOP", "LOOK", dsb
- Buat konten yang flow natural seperti manusia ngobrol
- Jangan terdengar seperti AI yang terlalu formal atau terlalu excited
- NO MARKDOWN: Jangan pakai *, **, ***, __, ___, atau formatting markdown lainnya`
  } else {
    return `You are a professional copywriter expert in creating converting social media content using the SLAP framework (Stop, Look, Act, Purchase).

SLAP FRAMEWORK:
1. STOP - Create scroll-stopping opening (strong hook, provocative question, or shocking statement)
2. LOOK - Build interest and curiosity (interesting facts, pain points, or relatable benefits)
3. ACT - Drive desire and action (concrete solutions, actionable tips, or value proposition)
4. PURCHASE - Persuasive closing (clear CTA or engagement hook)

WRITING STYLE:
- Tone: ${toneMap[tone] || 'casual and friendly'}
- Write like a HUMAN talks, not AI or robot
- Natural, conversational, and authentic language
- Use engaging and relatable storytelling
- Bullet points or numbered lists for readability
- MINIMAL emojis (max 1-2 only, or none at all)
- Avoid cliché buzzwords like "game-changer", "unlock", "dive in", "level up"
- Focus on concrete benefits, not technical features
- Personal and genuine, not sales-y or pushy

FORMAT:
- Strong and NATURAL opening hook (1-2 sentences)
- Valuable and actionable body
- Closing with CTA or engaging question
- DO NOT use markdown formatting (* ** ___ for bold/italic)
- Use PLAIN TEXT only without special formatting
- For emphasis, use capitalization or line break, NOT asterisks

IMPORTANT: 
- Write ONLY the post content, without labels like "STOP", "LOOK", etc
- Make content flow naturally like human conversation
- Don't sound like AI that's too formal or too excited
- NO MARKDOWN: Don't use *, **, ***, __, ___, or any markdown formatting`
  }
}

function buildUserPrompt(params: GenerateContentParams): string {
  const { customPrompt, maxLength, includeHashtags, language, platform } = params
  
  let prompt = ''
  
  if (language === 'id') {
    prompt = `TASK: ${customPrompt}

STRUKTUR YANG HARUS DIIKUTI:
1. HOOK (Stop): Mulai dengan opening yang powerful - bisa berupa:
   - Pertanyaan yang bikin penasaran
   - Statement kontroversial/mengejutkan
   - Pain point yang relatable
   - Angka/fakta yang wow

2. VALUE (Look): Berikan insight atau informasi menarik:
   - Ceritakan story yang engaging
   - Jelaskan pain point dan solusinya
   - Berikan fakta/data yang mendukung
   
3. ACTION (Act): Berikan value konkret:
   - Tips actionable (gunakan bullet points atau numbering)
   - Solusi praktis yang bisa langsung diterapkan
   - Step-by-step jika diperlukan

4. ENGAGEMENT (Purchase): Tutup dengan strong CTA:
   - Ajakan bertindak yang jelas
   - Pertanyaan engaging untuk diskusi
   - Dorongan untuk save/share/comment

REQUIREMENTS:
- Maksimal ${maxLength} karakter (PENTING: jangan melebihi ini, tutup dengan natural!)
- ${includeHashtags ? 'Sertakan 3-5 hashtag strategis di akhir' : 'Tidak perlu hashtag'}
- MINIMAL emoji (maksimal 1-2 saja, atau tidak pakai sama sekali)
- Line breaks untuk readability
- Bahasa Indonesia yang natural seperti orang ngobrol
- Hindari kata-kata klise seperti "game-changer", "next level", "secret sauce"
- Tulis seperti manusia yang sharing pengalaman atau insight
- Tutup konten dengan kalimat yang complete, jangan putus di tengah
- Platform: ${platform}

CONTOH STRUKTUR:
[Hook yang kuat dan natural - tanpa emoji berlebihan]

[Story/context yang relatable - cerita seperti manusia biasa]

[Value/tips dengan bullets - GUNAKAN PLAIN TEXT:]
Poin 1 (ditulis dengan bahasa natural, tanpa asterisk)
Poin 2 (fokus pada benefit konkret, tanpa bold/italic)
Poin 3 (actionable dan praktis, plain text saja)

[CTA atau pertanyaan engaging yang genuine]

${includeHashtags ? '[Hashtags]' : ''}

Tulis HANYA konten postnya, mulai langsung dari hook! 
PENTING: JANGAN gunakan * atau ** untuk formatting. Gunakan plain text natural saja seperti orang chat biasa.`
  } else {
    prompt = `TASK: ${customPrompt}

STRUCTURE TO FOLLOW:
1. HOOK (Stop): Start with powerful opening - could be:
   - Curiosity-inducing question
   - Controversial/surprising statement
   - Relatable pain point
   - Wow numbers/facts

2. VALUE (Look): Provide interesting insights:
   - Tell engaging story
   - Explain pain point and solution
   - Provide supporting facts/data
   
3. ACTION (Act): Deliver concrete value:
   - Actionable tips (use bullet points or numbering)
   - Practical solutions to implement
   - Step-by-step if needed

4. ENGAGEMENT (Purchase): Close with strong CTA:
   - Clear call-to-action
   - Engaging question for discussion
   - Encouragement to save/share/comment

REQUIREMENTS:
- Maximum ${maxLength} characters (IMPORTANT: don't exceed this, end naturally!)
- ${includeHashtags ? 'Include 3-5 strategic hashtags at the end' : 'No hashtags needed'}
- MINIMAL emojis (max 1-2 only, or none at all)
- Line breaks for readability
- Natural conversational English like real people talk
- Avoid clichés like "game-changer", "next level", "secret sauce"
- Write like a human sharing experience or insight
- End content with complete sentence, don't cut off mid-thought
- Platform: ${platform}

EXAMPLE STRUCTURE:
[Strong and natural hook - without excessive emojis]

[Relatable story/context - written like a real person]

[Value/tips with bullets - USE PLAIN TEXT:]
Point 1 (written in natural language, no asterisks)
Point 2 (focus on concrete benefits, no bold/italic)
Point 3 (actionable and practical, plain text only)

[Genuine CTA or engaging question]

${includeHashtags ? '[Hashtags]' : ''}

Write ONLY the post content, start directly with the hook! 
IMPORTANT: DO NOT use * or ** for formatting. Use natural plain text like normal people chat.`
  }

  return prompt
}

export async function generateContent(params: GenerateContentParams): Promise<string> {
  const { tone, language, customPrompt } = params
  
  if (!customPrompt || !customPrompt.trim()) {
    throw new Error('customPrompt is required')
  }

  // Get system prompt
  const systemPrompt = getDefaultSystemPrompt(tone, language)
  
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
    
    // Remove markdown formatting (*, **, ___, etc)
    // Remove bold markers
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1') // Bold+Italic
    text = text.replace(/\*\*(.+?)\*\*/g, '$1')     // Bold
    text = text.replace(/\*(.+?)\*/g, '$1')         // Italic
    text = text.replace(/__(.+?)__/g, '$1')         // Bold (underscore)
    text = text.replace(/_(.+?)_/g, '$1')           // Italic (underscore)
    
    // Clean up any remaining stray asterisks
    text = text.replace(/\*+/g, '')
    text = text.replace(/_+/g, '')

    // Ensure max length - cut at sentence end if possible, but preserve hashtags
    if (text.length > params.maxLength) {
      // Check if there are hashtags at the end
      const hashtagRegex = /#[\w\u00C0-\u017F]+/g
      const hasHashtags = text.match(hashtagRegex)
      
      if (hasHashtags && params.includeHashtags) {
        // Find where hashtags start (usually after last sentence before hashtags)
        const lines = text.split('\n')
        let mainContentLength = 0
        let hashtagsText = ''
        
        // Find the line where hashtags start
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line.startsWith('#') || /^[\s#]/.test(line) && line.includes('#')) {
            // This line contains hashtags
            hashtagsText = lines.slice(i).join('\n')
            break
          }
          mainContentLength += lines[i].length + 1 // +1 for newline
        }
        
        if (hashtagsText && mainContentLength > 0) {
          // We found hashtags, try to fit main content + hashtags within limit
          const availableForContent = params.maxLength - hashtagsText.length - 10 // -10 for safety
          
          if (availableForContent > params.maxLength * 0.6) {
            // Cut main content smartly
            const mainContent = text.substring(0, mainContentLength - 1)
            let cutContent = mainContent.substring(0, availableForContent)
            
            // Try to cut at sentence end
            const lastPeriod = cutContent.lastIndexOf('.')
            const lastQuestion = cutContent.lastIndexOf('?')
            const lastExclamation = cutContent.lastIndexOf('!')
            const cutPoint = Math.max(lastPeriod, lastQuestion, lastExclamation)
            
            if (cutPoint > availableForContent * 0.7) {
              cutContent = cutContent.substring(0, cutPoint + 1).trim()
            } else {
              cutContent = cutContent.trim()
            }
            
            text = cutContent + '\n\n' + hashtagsText
          } else {
            // Not enough space, cut everything at maxLength
            text = text.substring(0, params.maxLength).trim()
          }
        } else {
          // Couldn't parse hashtags properly, cut at sentence
          const cutText = text.substring(0, params.maxLength)
          const lastPeriod = cutText.lastIndexOf('.')
          const lastQuestion = cutText.lastIndexOf('?')
          const lastExclamation = cutText.lastIndexOf('!')
          const cutPoint = Math.max(lastPeriod, lastQuestion, lastExclamation)
          
          if (cutPoint > params.maxLength * 0.8) {
            text = text.substring(0, cutPoint + 1).trim()
          } else {
            text = text.substring(0, params.maxLength).trim()
          }
        }
      } else {
        // No hashtags or not including them, cut normally
        const cutText = text.substring(0, params.maxLength)
        const lastPeriod = cutText.lastIndexOf('.')
        const lastNewline = cutText.lastIndexOf('\n')
        const lastQuestion = cutText.lastIndexOf('?')
        const lastExclamation = cutText.lastIndexOf('!')
        
        const cutPoint = Math.max(lastPeriod, lastNewline, lastQuestion, lastExclamation)
        
        if (cutPoint > params.maxLength * 0.8) {
          text = text.substring(0, cutPoint + 1).trim()
        } else {
          text = text.substring(0, params.maxLength).trim()
        }
      }
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
