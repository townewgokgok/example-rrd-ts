import * as fs from 'fs-promise';
import * as yaml from 'js-yaml';
import * as amqp from 'amqplib';
import promisify = require('promisify-node');
import {sprintf} from 'sprintf';
import RRDTool = require('node-rrdtool');
import sleep = require('sleep-promise');

interface Settings {
	amqp: {
		host: string;
		port?: number;
		user: string;
		pass: string;
		queue: string;
	};
	rrd: {
		file_path_fmt: string;
		step: number;
		heartbeat: number;
	};
}

interface RrdRequest {
	id: number;
	at: number;
	values: number[];
}

let s: Settings;
let startTime: number = 0;
let queue: { [id:number]: RrdRequest[]; } = {};

async function processRequest(id:number) {
	let path = sprintf(s.rrd.file_path_fmt, id);
	let rrd = new RRDTool();
	while (0 < queue[id].length) {
		let req = queue[id].shift();
		if (!fs.existsSync(path)) {
			console.log(`Creating RRD file: ${path}`);
			await promisify(rrd.create).call(rrd,
				path,
				[
					'--start', `${req.at - 1}`,
					'--step', `${s.rrd.step}`,
					`DS:value1:GAUGE:${s.rrd.heartbeat}:U:U`,
					`DS:value2:GAUGE:${s.rrd.heartbeat}:U:U`,
					`DS:value3:GAUGE:${s.rrd.heartbeat}:U:U`
				],
				[
					`RRA:AVERAGE:0.5:1:60`
				]
			);
		}
		let args = req.values.map(v => v.toString());
		args.unshift(req.at.toString());
		console.log(`Updating RRD file: ${path} @ ${req.at}`);
		await promisify(rrd.update).call(rrd, path, args.join(':'));
		let dt = (new Date).getTime() / 1000.0 - startTime;
		console.log(`${dt} [sec]`);
	}
	delete queue[id];
}

function onAmqpMessage(msg: amqp.Message) {
	if (startTime == 0) startTime = (new Date).getTime() / 1000.0;
	let req: RrdRequest = JSON.parse(msg.content.toString());
	// console.log(`Received a message ${JSON.stringify(req)}`);
	if (!queue[req.id]) {
		queue[req.id] = [req];
		processRequest(req.id).catch(err => {
			console.log(err);
		});
	}
	else {
		queue[req.id].push(req);
	}
}

async function main() {
	const yamlSrc = await fs.readFile('settings.yml');
	s = yaml.safeLoad(yamlSrc.toString());

	const location = `amqp://${s.amqp.user}:${s.amqp.pass}@${s.amqp.host}:${s.amqp.port||5672}`;
	console.log(`Connecting to ${location}`);
	let conn = await amqp.connect(location);
	let ch = await conn.createChannel();
	ch.assertQueue(s.amqp.queue, {durable: true});

	console.log('Waiting for messages');
	await ch.consume(s.amqp.queue, onAmqpMessage, {noAck: true});
}

main().catch(err => {
	console.log(err);
});
