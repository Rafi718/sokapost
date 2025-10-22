/**
 * Smart text splitter untuk membagi konten panjang jadi beberapa part
 * dengan mempertahankan context dan readability
 */

interface SplitResult {
  parts: string[]
  totalLength: number
}

export function smartSplitText(text: string, maxLength: number = 500): SplitResult {
  // Jika text sudah dibawah limit, return as is
  if (text.length <= maxLength) {
    return {
      parts: [text],
      totalLength: text.length
    }
  }

  const parts: string[] = []
  let remainingText = text
  
  // Check apakah ada hashtags di akhir
  const hashtagMatch = text.match(/(#[\w\u00C0-\u017F]+(\s+#[\w\u00C0-\u017F]+)*)\s*$/m)
  let hashtags = ''
  
  if (hashtagMatch) {
    hashtags = hashtagMatch[1]
    remainingText = text.substring(0, text.lastIndexOf(hashtags)).trim()
  }

  // Split by paragraphs first (double line breaks)
  const paragraphs = remainingText.split(/\n\n+/)
  
  let currentPart = ''
  let partIndex = 0
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim()
    
    // Reserve space for hashtags in first part
    const reserveSpace = partIndex === 0 && hashtags ? hashtags.length + 4 : 0
    const availableSpace = maxLength - reserveSpace
    
    // Jika paragraph + current part masih fit
    if ((currentPart + '\n\n' + paragraph).length <= availableSpace) {
      if (currentPart) {
        currentPart += '\n\n' + paragraph
      } else {
        currentPart = paragraph
      }
    } else {
      // Current part sudah penuh, save dan mulai part baru
      if (currentPart) {
        // Add hashtags to first part only
        if (partIndex === 0 && hashtags) {
          currentPart += '\n\n' + hashtags
        }
        parts.push(currentPart)
        partIndex++
      }
      
      // Check if paragraph itself too long
      if (paragraph.length > maxLength) {
        // Split by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]
        let tempPart = ''
        
        for (const sentence of sentences) {
          if ((tempPart + sentence).length <= maxLength) {
            tempPart += sentence
          } else {
            if (tempPart) {
              parts.push(tempPart.trim())
              partIndex++
            }
            // If sentence itself too long, hard cut
            if (sentence.length > maxLength) {
              const chunks = chunkString(sentence, maxLength)
              parts.push(...chunks.slice(0, -1))
              partIndex += chunks.length - 1
              tempPart = chunks[chunks.length - 1]
            } else {
              tempPart = sentence
            }
          }
        }
        
        currentPart = tempPart
      } else {
        currentPart = paragraph
      }
    }
  }
  
  // Add last part
  if (currentPart) {
    // Add hashtags to last part if not added yet
    if (parts.length === 0 && hashtags) {
      currentPart += '\n\n' + hashtags
    }
    parts.push(currentPart)
  }
  
  // Add continuation markers
  const labeledParts = parts.map((part, index) => {
    if (parts.length === 1) return part
    
    // First part - no label needed, has hashtags
    if (index === 0) {
      return part
    }
    
    // Middle/Last parts - add continuation marker
    const marker = `(${index + 1}/${parts.length})`
    return `${marker}\n\n${part}`
  })

  return {
    parts: labeledParts,
    totalLength: text.length
  }
}

function chunkString(str: string, size: number): string[] {
  const chunks: string[] = []
  let index = 0
  
  while (index < str.length) {
    chunks.push(str.slice(index, index + size))
    index += size
  }
  
  return chunks
}

/**
 * Preview how text will be split
 */
export function previewSplit(text: string, maxLength: number = 500): string {
  const result = smartSplitText(text, maxLength)
  
  if (result.parts.length === 1) {
    return `✅ Content fits in single post (${result.totalLength} chars)`
  }
  
  return `📝 Content will be split into ${result.parts.length} parts:\n` +
    result.parts.map((part, i) => 
      `Part ${i + 1}: ${part.length} chars`
    ).join('\n')
}
