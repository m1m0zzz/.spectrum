export const clamp = (num: number, min: number, max: number) => {
	return Math.max(min, Math.min(num, max));
};

export const padding = (size: number, numString: number | string) => {
	return ('0'.repeat(size) + String(numString)).slice(-size);
};

export const formatDate = (date: Date) => {
	const Y = date.getFullYear();
	const M = padding(2, date.getMonth() + 1);
	const D = padding(2, date.getDate());
	const h = padding(2, date.getHours());
	const m = padding(2, date.getMinutes());
	const s = padding(2, date.getSeconds());
	return Y + '_' + M + '_' + D + '_' + h + '_' + m + '_' + s;
};

export const capitalize = (str: string) => {
	return str[0].toUpperCase() + str.slice(1);
};
