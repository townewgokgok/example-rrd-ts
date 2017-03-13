declare module 'node-rrdtool' {

	class RRDTool {
		constructor(options?:{path?:string});
		create(filePath:string, ds:string[], rra:string[], parameters:string[], callback:(err?:string)=>void): void;
		update(filePath:string, values:string[], callback:(err?:string)=>void): void;
	}

	export = RRDTool;

}

