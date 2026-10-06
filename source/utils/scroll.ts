export interface ScrollWindow {
	startIndex: number;
	endIndex: number;
	totalItems: number;
	hasPrev: boolean;
	hasNext: boolean;
	prevCount: number;
	nextCount: number;
}

export function computeScrollWindow(
	currentIndex: number,
	totalItems: number,
	maxVisible: number,
): ScrollWindow {
	if (totalItems <= maxVisible) {
		return {
			startIndex: 0,
			endIndex: totalItems,
			totalItems,
			hasPrev: false,
			hasNext: false,
			prevCount: 0,
			nextCount: 0,
		};
	}

	let startIndex = currentIndex - Math.floor(maxVisible / 2);
	if (startIndex < 0) {
		startIndex = 0;
	} else if (startIndex + maxVisible > totalItems) {
		startIndex = totalItems - maxVisible;
	}

	const endIndex = startIndex + maxVisible;
	return {
		startIndex,
		endIndex,
		totalItems,
		hasPrev: startIndex > 0,
		hasNext: endIndex < totalItems,
		prevCount: startIndex,
		nextCount: totalItems - endIndex,
	};
}
