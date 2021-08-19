import axios from 'axios';
import { Mutex } from 'async-mutex';
import Big from 'big.js';
import config from '../config';

export const CURRENCY_CODES = [
  'AED',
  'AFN',
  'ALL',
  'AMD',
  'ANG',
  'AOA',
  'ARS',
  'AUD',
  'AWG',
  'AZN',
  'BAM',
  'BBD',
  'BDT',
  'BGN',
  'BHD',
  'BIF',
  'BMD',
  'BND',
  'BOB',
  'BRL',
  'BSD',
  'BTN',
  'BWP',
  'BYN',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CLF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CUC',
  'CUP',
  'CVE',
  'CZK',
  'DJF',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'ERN',
  'ETB',
  'EUR',
  'FJD',
  'FKP',
  'GBP',
  'GEL',
  'GGP',
  'GHS',
  'GIP',
  'GMD',
  'GNF',
  'GTQ',
  'GYD',
  'HKD',
  'HNL',
  'HRK',
  'HTG',
  'HUF',
  'IDR',
  'ILS',
  'IMP',
  'INR',
  'IQD',
  'IRR',
  'ISK',
  'JEP',
  'JMD',
  'JOD',
  'JPY',
  'KES',
  'KGS',
  'KHR',
  'KMF',
  'KPW',
  'KRW',
  'KWD',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LKR',
  'LRD',
  'LSL',
  'LYD',
  'MAD',
  'MDL',
  'MKD',
  'MMK',
  'MNT',
  'MOP',
  'MUR',
  'MVR',
  'MWK',
  'MXN',
  'MYR',
  'MZN',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'OMR',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'RWF',
  'SAR',
  'SBD',
  'SCR',
  'SDG',
  'SEK',
  'SGD',
  'SHP',
  'SLL',
  'SOS',
  'SRD',
  'SSP',
  'STD',
  'SVC',
  'SYP',
  'SZL',
  'THB',
  'TJS',
  'TMT',
  'TND',
  'TOP',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'UYU',
  'UZS',
  'VND',
  'VUV',
  'WST',
  'XAF',
  'XAG',
  'XAU',
  'XCD',
  'XDR',
  'XPF',
  'YER',
  'ZAR',
  'ZMW',
];

type RateResp = {
  rates: { [code: string]: number };
  base: string;
  date: string;
};

const currencyTTL = 24 * 60 * 60;

const mutex = new Mutex();

const currencyFallbacks: { [from: string]: { [to: string]: number } } = {
  CNY: { USD: 0.154 },
};

async function convert(
  from: string,
  to: string,
  amount: number
): Promise<number> {
  const rate = await getRate(from, to);

  return new Big(amount).times(rate).round(10).toNumber();
}

async function getRate(from: string, to: string): Promise<Big> {
  const cacheKey = `currency-${from}-${to}`;

  // Use a mutex so we only query the API once
  const release = await mutex.acquire();

  try {
    let rate = config.cache.get<number>(`currency-${from}-${to}`);
    if (rate !== undefined) {
      return new Big(rate);
    }

    rate = await queryRate(from, to);
    if (rate !== undefined) {
      config.logger.debug(
        `Saving ${cacheKey}=${rate} to cache with TTL ${currencyTTL}`
      );
      const ok = config.cache.set(`currency-${from}-${to}`, rate, currencyTTL);
      if (!ok) {
        config.logger.warn('Could not store exchange rate in cache');
      }

      return new Big(rate);
    }

    config.logger.warn('No exchange rate found, falling back to default rate');
    return new Big(currencyFallbacks[from][to]);
  } finally {
    release();
  }
}

async function queryRate(
  from: string,
  to: string
): Promise<number | undefined> {
  const url = `https://api.exchangerate.host/latest?base=${from}&symbols=${to}`;

  try {
    config.logger.debug(`Querying exchange rate from: ${url}`);
    const resp = await axios({
      method: 'get',
      url,
    });

    return (<RateResp>resp.data).rates[to];
  } catch (err) {
    config.logger.error('Error querying exchange rate:');
    config.logger.error(err);
    return undefined;
  }
}

export default {
  convert,
};
