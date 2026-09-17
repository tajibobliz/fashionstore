export interface PaginationParams { page?: number; limit?: number }
export interface PaginatedResponse<T> { data: T[]; total?: number; page?: number; limit?: number }
export interface DateRangeParams { desde?: string; hasta?: string }
export interface ApiErrorResponse { statusCode?: number; message?: string | string[]; error?: string }
