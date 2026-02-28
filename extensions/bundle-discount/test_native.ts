import { cartLinesDiscountsGenerateRun } from './src/cart_lines_discounts_generate_run';
import fs from 'fs';

const fixtureStr = fs.readFileSync('./tests/fixtures/cart-lines-bundle.json', 'utf-8');
const fixture = JSON.parse(fixtureStr);

const result = cartLinesDiscountsGenerateRun(fixture.payload.input);
console.log(JSON.stringify(result, null, 2));
