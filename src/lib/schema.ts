import { z } from 'zod'

// Multiple-answers contract: choices length is 4; answerIndexes is a set of indices within 0..3 (0..4 items)
export const QuestionSchema = z.object({
    question: z.string(),
    choices: z.array(z.string()).length(4),
    answerIndexes: z
        .array(z.number().int().min(0).max(3))
        .max(4)
        .superRefine((arr, ctx) => {
            const set = new Set(arr)
            if (set.size !== arr.length) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'answerIndexes must be unique' })
            }
        }),
    explanation: z.string(),
})

export type Question = z.infer<typeof QuestionSchema>
