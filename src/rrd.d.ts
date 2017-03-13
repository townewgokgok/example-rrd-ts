declare module 'rrd';

declare class RRD {
	constructor(filename:string);
	create(rrdArgs:string[], options:{start?:Date}, cb:(err?:string)=>void): void;
}

// export as namespace rrd;
