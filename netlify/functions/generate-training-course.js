const fetch = require('node-fetch');

// Generate a full training course from document content using AI
// IMPORTANT: This PRESERVES all content - it reformats, doesn't summarize
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { content, filename, courseType, mode, chunkInfo } = JSON.parse(event.body);

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    if (!content || content.trim().length < 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Document content is too short.' })
      };
    }

    // Different prompts for chunk mode vs full mode
    const isChunkMode = mode === 'chunk';
    
    const chunkPrompt = `You are a training content formatter for ASAP Credit Repair USA.

CRITICAL: You are REFORMATTING content, NOT summarizing it. PRESERVE ALL INFORMATION.

You are processing PART of a larger training document (${chunkInfo?.pages || 'section'}, chunk ${chunkInfo?.current || '?'} of ${chunkInfo?.total || '?'}).

Your job is to:
1. KEEP all the original content and information - DO NOT skip or summarize
2. Clean up the language - fix grammar, improve clarity
3. Organize into logical modules and lessons
4. Add helpful formatting tags for visual presentation
5. CREATE QUIZ QUESTIONS - This is REQUIRED for every module

FORMATTING TAGS you can add to lesson content:
- [KEY POINT]Important information here[/KEY POINT] - for critical facts
- [TIP]Helpful advice here[/TIP] - for best practices
- [WARNING]Caution info here[/WARNING] - for things to avoid
- [EXAMPLE]Real scenario here[/EXAMPLE] - for examples
- Use ## for section headers within lessons
- Use bullet points (•) for lists

QUIZ REQUIREMENTS (MANDATORY):
- Create 3-5 quiz questions PER MODULE
- Questions must test understanding of the actual content
- Include questions about specific facts, procedures, and requirements mentioned
- Mix question types: factual recall, application scenarios, best practices
- Each question needs 4 options with only ONE correct answer
- Provide explanations that reference the lesson content

RULES:
- PRESERVE all procedures, steps, details, and information from the original
- If content mentions specific numbers, dates, or requirements - KEEP THEM
- Break long content into multiple lessons rather than cutting it
- Every important fact from the source should appear in your output
- Simplify language but NEVER remove information

OUTPUT FORMAT - Return ONLY valid JSON, no markdown:
{
  "title": "Section Title Based on Content",
  "description": "What this section covers",
  "modules": [
    {
      "title": "Module Title",
      "description": "Module overview",
      "lessons": [
        {
          "title": "Lesson Title",
          "content": "FULL lesson content. Include ALL information from source. Use formatting tags. This should be COMPREHENSIVE - multiple paragraphs are expected. Include step-by-step details, specific requirements, examples from the source material. DO NOT truncate or summarize."
        }
      ],
      "quiz": [
        {
          "question": "What is the correct procedure for [specific topic from content]?",
          "options": ["A) Correct answer from content", "B) Plausible wrong answer", "C) Another wrong option", "D) Another wrong option"],
          "correct": 0,
          "explanation": "According to the training material, the correct approach is [reference specific content]..."
        },
        {
          "question": "When handling [situation from content], what should you do first?",
          "options": ["A) Wrong option", "B) Correct procedure from content", "C) Wrong option", "D) Wrong option"],
          "correct": 1,
          "explanation": "The training states that you should [specific reference]..."
        },
        {
          "question": "Which of the following is TRUE about [topic from content]?",
          "options": ["A) Wrong statement", "B) Wrong statement", "C) Correct fact from content", "D) Wrong statement"],
          "correct": 2,
          "explanation": "This is correct because the material specifically mentions [reference]..."
        }
      ]
    }
  ]
}

IMPORTANT: Every module MUST have a quiz array with 3-5 questions. Do not skip quiz generation.`;

    const fullPrompt = `You are a training content formatter for ASAP Credit Repair USA.

CRITICAL: You are REFORMATTING content, NOT summarizing it. PRESERVE ALL INFORMATION.

Your job is to transform the source document into a well-structured training course while keeping ALL the original information intact.

DO:
✓ Keep all facts, procedures, steps, and details
✓ Clean up language and fix grammar
✓ Organize into logical modules and lessons
✓ Add formatting tags for visual appeal
✓ CREATE QUIZ QUESTIONS for every module (3-5 questions each)
✓ Break long sections into multiple lessons

DO NOT:
✗ Skip or summarize content
✗ Remove "less important" details
✗ Truncate procedures or steps
✗ Leave out specific numbers, dates, or requirements
✗ Skip quiz generation - this is REQUIRED

FORMATTING TAGS for lesson content:
- [KEY POINT]Critical information[/KEY POINT]
- [TIP]Best practice advice[/TIP]
- [WARNING]Things to avoid or watch out for[/WARNING]
- [EXAMPLE]Real scenario or example[/EXAMPLE]
- ## for section headers
- • for bullet points

QUIZ REQUIREMENTS:
- 3-5 questions per module (MANDATORY)
- Test specific facts and procedures from the content
- Include scenario-based questions
- 4 options per question, only ONE correct
- Explanations must reference the lesson content

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "title": "Course Title",
  "description": "Course overview",
  "estimated_time": "Based on content length",
  "modules": [
    {
      "title": "Module Title",
      "description": "Module overview",
      "lessons": [
        {
          "title": "Lesson Title",
          "content": "COMPLETE lesson content preserving ALL source material. Use formatting tags. Multiple paragraphs expected. Include every detail, step, and requirement from the source."
        }
      ],
      "quiz": [
        {
          "question": "Specific question about content?",
          "options": ["A) Correct answer", "B) Wrong", "C) Wrong", "D) Wrong"],
          "correct": 0,
          "explanation": "This is correct because the training states..."
        },
        {
          "question": "Another question testing understanding?",
          "options": ["A) Wrong", "B) Wrong", "C) Correct answer", "D) Wrong"],
          "correct": 2,
          "explanation": "According to the material..."
        },
        {
          "question": "Scenario: A client asks about [topic]. What should you do?",
          "options": ["A) Wrong approach", "B) Correct procedure", "C) Wrong approach", "D) Wrong approach"],
          "correct": 1,
          "explanation": "The correct procedure is..."
        }
      ]
    }
  ]
}

A trainee reading your output should learn EVERYTHING they would have learned from the original document. Every module MUST include quiz questions.`;

    const systemPrompt = isChunkMode ? chunkPrompt : fullPrompt;
    
    // Allow more content through for better preservation
    const truncatedContent = content.substring(0, 20000);

    console.log(`Generating training course from: ${filename}, ${content.length} chars, mode: ${mode || 'full'}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `REFORMAT this content into training lessons with QUIZZES. PRESERVE ALL INFORMATION - do not summarize. Create 3-5 quiz questions per module:\n\nSource: ${filename}\n\n---BEGIN CONTENT---\n${truncatedContent}\n---END CONTENT---` }
        ],
        max_tokens: isChunkMode ? 4000 : 4000,
        temperature: 0.3, // Lower temperature for more faithful reproduction
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI error:', error);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'OpenAI API error' })
      };
    }

    const data = await response.json();
    const contentResponse = data.choices[0]?.message?.content || '{}';
    
    let course = null;
    try {
      let cleanJson = contentResponse.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      course = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('Failed to parse course:', parseErr);
      const match = contentResponse.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          course = JSON.parse(match[0]);
        } catch (e) {
          return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate course structure' })
          };
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course, filename })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
