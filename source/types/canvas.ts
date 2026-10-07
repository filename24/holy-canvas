export interface CanvasConfig {
	domain: string;
	token: string;
	language?: string;
}

export interface Course {
	id: number;
	name: string;
	course_code: string;
	workflow_state: string;
	enrollment_term_id: number;
	start_at: string | null;
	end_at: string | null;
	default_view: string;
	syllabus_body?: string;
	enrollments?: Enrollment[];
	term?: EnrollmentTerm;
}

export interface Enrollment {
	id: number;
	course_id: number;
	type: string;
	enrollment_state: string;
	grades?: Grade;
	user?: User;
}

export interface Grade {
	html_url: string;
	current_score: number | null;
	final_score: number | null;
	current_grade: string | null;
	final_grade: string | null;
	current_points?: number;
}

export interface Quiz {
	id: number;
	title: string;
	points_possible: number;
	quiz_type: string;
	due_at: string | null;
	time_limit: number | null;
	question_count: number;
}

export interface QuizSubmission {
	id: number;
	quiz_id: number;
	score: number | null;
	kept_score: number | null;
	attempt: number;
	finished_at: string | null;
	workflow_state: string;
}

export interface CanvasFile {
	id: number;
	display_name: string;
	filename: string;
	url: string;
	size: number;
	'content-type': string;
	updated_at: string;
	created_at: string;
	folder_id: number;
	download_headers?: Record<string, string>;
}

export interface Folder {
	id: number;
	name: string;
	full_name: string;
	parent_folder_id: number | null;
	files_count: number;
	folders_count: number;
	updated_at: string;
}

export interface Module {
	id: number;
	name: string;
	position: number;
	items_count: number;
	state?: string;
	items?: ModuleItem[];
}

export interface ModuleItem {
	id: number;
	title: string;
	type: string;
	content_id: number;
	html_url: string;
	position: number;
}

export interface Assignment {
	id: number;
	name: string;
	due_at: string | null;
	points_possible: number;
	html_url: string;
	submission_types: string[];
	has_submitted_submissions: boolean;
}

export interface AssignmentAnalytics {
	assignment_id: number;
	title: string;
	points_possible: number;
	due_at: string | null;
	muted: boolean;
	min_score: number;
	max_score: number;
	median: number;
	submission?: {
		posted_at: string | null;
		submitted_at: string | null;
		score: number | null;
	};
}

export interface Announcement {
	id: number;
	title: string;
	message: string;
	posted_at: string;
	context_code: string;
}

export interface User {
	id: number;
	name: string;
	short_name: string;
	sortable_name: string;
	email?: string;
	avatar_url?: string;
	login_id?: string;
}

export interface EnrollmentTerm {
	id: number;
	name: string;
	start_at: string | null;
	end_at: string | null;
}

export interface TodoItem {
	type: 'grading' | 'submitting';
	assignment: Assignment;
	html_url: string;
	needs_grading_count?: number;
	context_type: string;
	course_id: number;
}
