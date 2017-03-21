import * as fs from 'fs-promise';
import * as yaml from 'js-yaml';
import * as amqp from 'amqplib';
import bluebird = require('bluebird');
import {sprintf} from 'sprintf';
import rrd = require('rrd');
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
	msg?: amqp.Message;
}

let s: Settings;
let startTime: number = 0;
let count: number = 0;
let queue: { [id:number]: RrdRequest[]; } = {};
let conn: amqp.Connection;
let ch: amqp.Channel;

async function processRequest(id:number) {
	let path = sprintf(s.rrd.file_path_fmt, id);
	while (0 < queue[id].length) {
		let req = queue[id].shift();
		if (!fs.existsSync(path)) {
			// console.log(`Creating RRD file: ${path}`);
			await bluebird.promisify(rrd.create).call(rrd,
				path,
				s.rrd.step,
				req.at - 1,
				[
					`DS:value1:GAUGE:${s.rrd.heartbeat}:U:U`,
					`DS:value2:GAUGE:${s.rrd.heartbeat}:U:U`,
					`DS:value3:GAUGE:${s.rrd.heartbeat}:U:U`,
					`RRA:AVERAGE:0.5:1:3600`
				]
			);
		}

		// console.log(`Updating RRD file: ${path} @ ${req.at} ${req.values.join(" ")}`);
		let args = req.values.map(v => `${v}`);
		args.unshift(req.at.toString());
		for (let i=0; i<60; i++) {
			args[0] = `${req.at + i}`;
			await bluebird.promisify(rrd.update).call(rrd, path, "value1:value2:value3", [args.join(":")]);
		}

		console.log(`Sending ack: tag=${req.msg.fields.deliveryTag} id=${req.msg.properties.messageId}`);
		ch.ack(req.msg);

		let dt = (new Date).getTime() / 1000.0 - startTime;
		console.log(`${++count} ${dt} [sec]`);
		if (count==1200) setTimeout(()=>process.exit(0), 100);
	}
	delete queue[id];
}

let received: number = 0;

function onAmqpMessage(msg: amqp.Message) {
	console.log(`${++received} Received a message id=${msg.properties.messageId}`);
	if (startTime == 0) startTime = (new Date).getTime() / 1000.0;
	let req: RrdRequest = JSON.parse(msg.content.toString());
	req.msg = msg;
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
	// console.log("Settings loaded: " + JSON.stringify(s));

	const location = `amqp://${s.amqp.user}:${s.amqp.pass}@${s.amqp.host}:${s.amqp.port||5672}`;
	console.log(`Connecting to ${location}`);
	conn = await amqp.connect(location);
	ch = await conn.createChannel();
	ch.assertQueue(s.amqp.queue, {durable: true});

	console.log('Waiting for messages');
	await ch.consume(s.amqp.queue, onAmqpMessage, {noAck: false});
}

main().catch(err => {
	console.log(err);
});
