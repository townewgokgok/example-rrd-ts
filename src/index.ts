import * as fs from 'fs-promise';
import * as yaml from 'js-yaml';
import * as amqp from 'amqplib';

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

async function main() {
	const yamlSrc = await fs.readFile('settings.yml');
	const s: Settings = yaml.safeLoad(yamlSrc.toString());
	const url = `amqp://${s.amqp.user}:${s.amqp.pass}@${s.amqp.host}:${s.amqp.port}`;
	console.log(`Connecting to ${url}`);
	let conn = await amqp.connect(url);
	let ch = await conn.createChannel();
	ch.assertQueue(s.amqp.queue, {durable: true});
	await ch.consume(s.amqp.queue, msg => {
		console.log(" [x] Received %s", msg.content.toString());
	}, {noAck: false});
}

main().catch(err => {
	console.log(err);
});
