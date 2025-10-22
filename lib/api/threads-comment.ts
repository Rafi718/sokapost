import axios from 'axios'

export interface ThreadsCommentParams {
  accessToken: string
  userId: string
  postId: string
  text: string
}

/**
 * Create a reply/comment on a Threads post
 */
export async function createThreadsComment(params: ThreadsCommentParams): Promise<string> {
  const { accessToken, userId, postId, text } = params

  try {
    console.log('[Threads Comment] Creating comment:', {
      postId,
      textLength: text.length
    })

    // Step 1: Create threads media container for reply
    const containerResponse = await axios.post(
      `https://graph.threads.net/v1.0/${userId}/threads`,
      null,
      {
        params: {
          media_type: 'TEXT',
          text: text,
          reply_to_id: postId, // This makes it a comment/reply
          access_token: accessToken
        }
      }
    )

    const containerId = containerResponse.data.id
    console.log('[Threads Comment] Container created:', containerId)

    // Step 2: Publish the reply
    const publishResponse = await axios.post(
      `https://graph.threads.net/v1.0/${userId}/threads_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: accessToken
        }
      }
    )

    const commentId = publishResponse.data.id
    console.log('[Threads Comment] Comment published:', commentId)

    return commentId
  } catch (error: any) {
    console.error('[Threads Comment] Error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error?.message || 'Failed to create comment')
  }
}

/**
 * Post multiple comments in sequence (for split content)
 * Comments will be chained - each comment replies to the previous one
 */
export async function createThreadsCommentThread(
  params: Omit<ThreadsCommentParams, 'text'> & { texts: string[] }
): Promise<string[]> {
  const { texts, ...baseParams } = params
  const commentIds: string[] = []
  
  // Start with main post ID
  let currentReplyToId = baseParams.postId

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]
    
    try {
      console.log(`[Threads Comment Thread] Posting comment ${i + 1}/${texts.length}`)
      console.log(`   Reply to: ${currentReplyToId}`)
      
      const commentId = await createThreadsComment({
        ...baseParams,
        postId: currentReplyToId, // Reply to previous comment (chain)
        text
      })
      
      commentIds.push(commentId)
      console.log(`   ✅ Comment posted: ${commentId}`)
      
      // Update reply_to_id for next comment (chain)
      currentReplyToId = commentId
      
      // Delay between comments to avoid rate limiting
      if (i < texts.length - 1) {
        console.log(`   ⏳ Waiting 3 seconds before next comment...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    } catch (error: any) {
      console.error(`[Threads Comment Thread] Failed at part ${i + 1}:`, error)
      console.error(`   Error: ${error.message}`)
      
      // STOP if one fails - don't continue
      // Otherwise comments won't be chained properly
      throw error
    }
  }

  return commentIds
}
