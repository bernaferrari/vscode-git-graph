/**
 * Toast hook wrapper around Sonner
 */
import { toast as sonnerToast } from 'sonner';

export const toast = {
	success: (title: string, description?: string) => 
		sonnerToast.success(title, { description }),
	
	error: (title: string, description?: string) => 
		sonnerToast.error(title, { description }),
	
	info: (title: string, description?: string) => 
		sonnerToast.info(title, { description }),
	
	warning: (title: string, description?: string) => 
		sonnerToast.warning(title, { description }),
	
	loading: (title: string, description?: string) => 
		sonnerToast.loading(title, { description }),
	
	promise: <T,>(
		promise: Promise<T>,
		{
			loading,
			success,
			error,
		}: {
			loading: string;
			success: string | ((data: T) => string);
			error: string | ((err: Error) => string);
		}
	) => sonnerToast.promise(promise, { loading, success, error }),
	
	dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

export { sonnerToast };
