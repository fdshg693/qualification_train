import { z } from 'zod'

// Multiple-answers contract: choices length is 2..8; answerIndexes are unique and within 0..choices.length-1
export const QuestionSchema = z
    .object({
        question: z.string(),
        choices: z.array(z.string()).min(2).max(8),
        answerIndexes: z.array(z.number().int().min(0)).max(8),
        explanations: z.array(z.string()),
    })
    .superRefine((obj, ctx) => {
        // explanations length == choices length
        if (obj.explanations.length !== obj.choices.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'explanations must match choices length', path: ['explanations'] })
        }
        // answer indexes unique and in range
        const uniq = new Set<number>()
        for (const i of obj.answerIndexes) {
            if (i < 0 || i >= obj.choices.length) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'answer index out of range', path: ['answerIndexes'] })
                break
            }
            uniq.add(i)
        }
        if (uniq.size !== obj.answerIndexes.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'answerIndexes must be unique', path: ['answerIndexes'] })
        }
    })

export type Question = z.infer<typeof QuestionSchema>
