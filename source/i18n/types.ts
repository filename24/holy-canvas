export type SupportedLanguage = 'en' | 'ko' | 'es' | 'ja' | 'zh';

export interface Translations {
	common: {
		loading: string;
		error: string;
		backHint: string;
		cancel: string;
		exit: string;
		retryHint: string;
		continueHint: string;
		statusActive: string;
	};
	menu: {
		title: string;
		modeSubtitle: string;
		connectedDomain: string;
		unconfigured: string;
		itemCourses: string;
		descCourses: string;
		itemGrades: string;
		descGrades: string;
		itemQuizzes: string;
		descQuizzes: string;
		itemFiles: string;
		descFiles: string;
		itemLanguage: string;
		descLanguage: string;
		itemSetup: string;
		descSetup: string;
		itemExit: string;
		descExit: string;
		navHint: string;
	};
	setup: {
		title: string;
		domainPrompt: string;
		domainExample: string;
		domainLabel: string;
		domainPlaceholder: string;
		tokenTitle: string;
		tokenPrompt: string;
		tokenLabel: string;
		connecting: string;
		successTitle: string;
		greeting: string;
		domainSaved: string;
		errorTitle: string;
		errorRetry: string;
		invalidToken: string;
		apiNotFound: string;
		domainUnreachable: string;
		needSetup: string;
		runSetupHint: string;
	};
	courses: {
		title: string;
		colIndex: string;
		colName: string;
		colCode: string;
		colStatus: string;
		empty: string;
		loading: string;
		navHint: string;
	};
	grades: {
		title: string;
		colCourse: string;
		colCurrentScore: string;
		colFinalScore: string;
		colCurrentGrade: string;
		colFinalGrade: string;
		empty: string;
		loading: string;
	};
	quizzes: {
		title: string;
		colCourse: string;
		colQuiz: string;
		colScore: string;
		colFinishedAt: string;
		empty: string;
		loading: string;
		loadingCourse: string;
	};
	files: {
		title: string;
		subtitle: string;
		allCoursesOption: string;
		allCoursesConfirmTitle: string;
		targetCoursesCount: string;
		collectedFilesCount: string;
		saveLocation: string;
		syncModeLabel: string;
		syncModeOn: string;
		syncModeOff: string;
		confirmNavHint: string;
		selectFilesTitle: string;
		selectFilesNavHint: string;
		loadingAllFiles: string;
		downloadingTitle: string;
		downloadComplete: string;
		filesSavedIn: string;
		moreAbove: string;
		moreBelow: string;
	};
	language: {
		title: string;
		selectPrompt: string;
		saved: string;
	};
}
