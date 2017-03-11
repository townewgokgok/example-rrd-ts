import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as amqp from 'amqplib';

const s: any = yaml.safeLoad(fs.readFileSync('settings.yml').toString());

const url = `amqp://${s.amqp.user}:${s.amqp.pass}@${s.amqp.host}:${s.amqp.port}`;
console.log(`Connecting to ${url}`);
amqp.connect(url)
	.catch(err => {
		console.log('Failed to connect AMQP server');
		throw err;
	})
	.then(conn => {
		return conn.createChannel();
	})
	.catch(err => {
		console.log('Failed to create AMQP channel');
		throw err;
	})
	.then(ch => {
		ch.assertQueue(s.amqp.queue, {durable: true});
		return ch.consume(s.amqp.queue, msg => {
			console.log(" [x] Received %s", msg.content.toString());
		});
	})
	.catch(err => {
		console.log('Failed to consume AMQP queue');
		throw err;
	});
