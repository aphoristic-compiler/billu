import { getEventsWithDetails } from './lib/actions/events';

async function run() {
  try {
    const res = await getEventsWithDetails();
    console.log("STRINGIFIED:", JSON.stringify(res));
  } catch (e) {
    console.error("ERROR", e);
  }
}
run();
