import { z } from 'zod'

export const QuestionSchema = z.object({
    question: z.string(),
    choices: z.array(z.string()).length(4),
    answerIndex: z.number().int().min(0).max(3),
    explanation: z.string(),
})

export type Question = z.infer<typeof QuestionSchema>
