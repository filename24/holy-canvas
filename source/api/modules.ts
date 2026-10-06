import type {CanvasClient} from './client.js';
import type {Module, ModuleItem} from '../types/canvas.js';

export async function listModules(
	client: CanvasClient,
	courseId: number,
): Promise<Module[]> {
	return client.getAll<Module>(`/courses/${courseId}/modules`, {
		'include[]': 'items',
	});
}

export async function listModuleItems(
	client: CanvasClient,
	courseId: number,
	moduleId: number,
): Promise<ModuleItem[]> {
	return client.getAll<ModuleItem>(
		`/courses/${courseId}/modules/${moduleId}/items`,
	);
}
