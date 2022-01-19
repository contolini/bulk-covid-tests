#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const csv = require('fast-csv');
const randomUseragent = require('random-useragent');
const { webkit } = require('playwright');

const fileName = process.argv.splice(2)[0];

if (!fileName) {
  return failure('Please provide a CSV with addresses. See https://github.com/contolini/bulk-covid-tests/#usage');
}

function exists(value) {
  return typeof value === 'string' && value.length > 1;
}

function success(msg) {
  return console.log(chalk.green('SUCCESS: ') + msg);
}

function failure(msg) {
  return console.log(chalk.red('FAILURE: ') + msg);
}

function info(msg) {
  return console.log(chalk.yellow('INFO: ') + msg);
}

function isEmailValid(email) {
  if (email) {
    return email.match(/^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/);
  }
  // email is optional
  return true;
}

function isStateValid(state) {
  return state.match(/^(?:(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY]))$/);
}

function isZipValid(zip) {
  return zip.match(/(^\d{5}$)|(^\d{5}-\d{4}$)/);
}

function validateRow({first_name, last_name, email, street_address, city, state, zip_code}) {
  return exists(first_name) &&
         exists(last_name) &&
         exists(street_address) &&
         exists(city) &&
         isEmailValid(email) &&
         isStateValid(state) &&
         isZipValid(zip_code);
}

function readCsv(fileName) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(path.resolve(fileName))
      .pipe(csv.parse({ headers: true, trim: true }))
      .validate(validateRow)
      .on('error', error => reject(error))
      .on('data', row => rows.push(row))
      .on('data-invalid', (row, rowNumber) => {
        failure(`Address #${rowNumber} has missing or invalid data: ${JSON.stringify(row)}`);
        reject();
      })
      .on('end', rowCount => {
        console.log(`Found ${rowCount} valid rows of addresses.`);
        resolve(rows);
      });
  });
}

async function orderTest(address) {
  const browser = await webkit.launch(
    { quiet: true }
  );
  const context = await browser.newContext({
    userAgent: randomUseragent.getRandom((ua) => {
      return [
        '/Browsers - Mac',
        '/Browsers - Windows'
      ].indexOf(ua.folder) === 0
    })
  });
  const page = await browser.newPage();
  await page.goto('https://special.usps.com/testkits');

  // Contact information
  await page.fill('#senderFirstName', address.first_name);
  await page.fill('#senderLastName', address.last_name);
  await page.fill('#senderEmail', address.email);

  // Shipping information
  await page.fill('#firstName', address.first_name_shipping || address.first_name);
  await page.fill('#lastName', address.last_name_shipping || address.last_name);
  await page.fill('#address1', address.street_address);
  await page.fill('#city', address.city);
  await page.selectOption('#state', address.state);
  await page.fill('#zipCode', address.zip_code);

  // Checkout
  await page.locator('text=Check Out Now').click();

  // Submit
  await page.locator('text=Place My Order').click();

  const message = await page.textContent('.red-banner, .message-wrapper, .confirmation-message > p > strong', {timeout: 5000});

  await browser.close();

  if (message.includes('have already been ordered for this address')) {
    return success(`Tests for ${address.first_name} ${address.last_name} have already been ordered. No new tests ordered.`);
  }

  if (message.includes('validate your address')) {
    return failure(`Ordering tests for ${address.first_name} ${address.last_name} failed due to an invalid address.`);
  }

  if (message.includes('Thank You!')) {
    return success(`Successfully ordered tests for ${address.first_name} ${address.last_name}: "${message}"`);
  }

  return failure(`Ordering tests for ${address.first_name} ${address.last_name} failed: "${message}"`);

}

async function orderTests(fileName) {
  try {
    const addresses = await readCsv(fileName);
    for (const address of addresses) {
      info(`Attempting to order COVID test kit for ${address.first_name} ${address.last_name}...`);
      try {
        await orderTest(address);
      } catch (error) {
        failure(error.message);
      }
    };
  } catch (error) {
    failure(error.message);
  }
  
}

orderTests(fileName);
