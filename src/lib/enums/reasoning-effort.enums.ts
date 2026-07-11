/**
 * Reasoning effort levels for thinking models.
 * These values are sent to the server and mapped to token budgets.
 */
export enum ReasoningEffort {
	MINIMAL = 'minimal',
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	MAX = 'max'
}
