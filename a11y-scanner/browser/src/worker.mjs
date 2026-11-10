import { scan } from './scan.mjs';

try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 65536) throw new Error('Anfrage ist zu groß.');
  }
  const report = await scan(JSON.parse(input));
  process.stdout.write(JSON.stringify(report));
} catch (error) {
  console.error(`Scan fehlgeschlagen: ${error.message ?? error}`);
  process.exitCode = 1;
}
