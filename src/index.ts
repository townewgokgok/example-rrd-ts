import * as fs from 'fs-promise';
import * as yaml from 'js-yaml';
import * as amqp from 'amqplib';
import {RRD} from 'rrd';

interface Settings {
	amqp: {
		host: string;
		port: number;
		user: string;
		pass: string;
		queue: string;
	};
	rrd: {
		file_path: string;
		step: number;
		heartbeat: number;
	};
}

interface RrdRequest {
	at: number;
	values: number[];
}

function rrdCreate(rrd:RRD, params:string[]): Promise<any> {
	return new Promise((resolve, reject) => {
		rrd.create(params, {}, (err:string) => {
			if (err) reject(err); else resolve();
		});
	});
}

let s: Settings;

async function processRequest(req: RrdRequest) {
	let rrd = new RRD(s.rrd.file_path);
	await rrdCreate(rrd, [
		`DS:value1:GAUGE:${s.rrd.heartbeat}:U:U`,
		`DS:value2:GAUGE:${s.rrd.heartbeat}:U:U`,
		`DS:value3:GAUGE:${s.rrd.heartbeat}:U:U`,
		`RRA:AVERAGE:0.5:1:60`
	]);
}

function onAmqpMessage(msg: amqp.Message) {
	let req: RrdRequest = JSON.parse(msg.content.toString());
	console.log(" [x] Received", req);
	processRequest(req).catch(err => {
		console.log(err);
	});
}

async function main() {
	const yamlSrc = await fs.readFile('settings.yml');
	s = yaml.safeLoad(yamlSrc.toString());
	const url = `amqp://${s.amqp.user}:${s.amqp.pass}@${s.amqp.host}:${s.amqp.port}`;
	console.log(`Connecting to ${url}`);
	let conn = await amqp.connect(url);
	let ch = await conn.createChannel();
	ch.assertQueue(s.amqp.queue, {durable: true});
	await ch.consume(s.amqp.queue, onAmqpMessage, {noAck: true});
}

main().catch(err => {
	console.log(err);
});
