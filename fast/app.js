import Fastify from 'fastify';
import fast from 'fast-cli/api.js';
import { convertToMpbs } from 'fast-cli/utilities.js';
import { StopWatch } from 'stopwatch-node';

function waitFor(observable) {
    return new Promise((resolve, reject) => {
        let value = [];
        observable.subscribe({
            next(newValue) {
                value = newValue;
            },
            complete() {
                delete value.isDone;
                value.downloadSpeed = convertToMpbs(value.downloadSpeed, value.downloadUnit);
                delete value.downloadUnit;
                value.uploadSpeed = convertToMpbs(value.uploadSpeed, value.uploadUnit);
                delete value.uploadUnit;
                resolve(value);
            },
            error(error) {
                reject(error);
            },
        });
    });
}

const app = Fastify({
    logger: true,
});

app.get('/', async (request, reply) => {
    const sw = new StopWatch('sw');
    sw.start('t');
    const result = await waitFor(fast({ measureUpload: true }));
    sw.stop();
    result.time = sw.getTask('t').timeMills;
    return { result: result };
});

app.get('/metrics', async (request, reply) => {
    const sw = new StopWatch('sw');
    sw.start('t');
    const result = await waitFor(fast({ measureUpload: true }));
    sw.stop();
    result.time = sw.getTask('t').timeMills;
    reply.send(`
# HELP fast_speedtest_speed Download and upload speed in Mbps
# TYPE fast_speedtest_speed gauge
fast_speedtest_speed{download="true"} ${result.downloadSpeed}
fast_speedtest_speed{download="false"} ${result.uploadSpeed}
# HELP fast_speedtest_latency Latency in milliseconds
# TYPE fast_speedtest_latency gauge
fast_speedtest_latency ${result.latency}
# HELP fast_speedtest_time Time taken to complete the test in milliseconds
# TYPE fast_speedtest_time gauge
fast_speedtest_time ${result.time}`);
    return;
});

try {
    app.listen({ port: 3000, host: '0.0.0.0' });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
