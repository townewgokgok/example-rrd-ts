declare module 'rrd' {
	var rrd : {
		create(filename:string, step:number, start_time:number, ds_rra:string[], callback:(error?:string)=>void): void;
		update(filename:string, template:string, updates:string[], callback:(error?:string)=>void): void;
	};

	export = rrd;
}
