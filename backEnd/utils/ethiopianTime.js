const TIME_ZONE = 'Africa/Addis_Ababa';

const getDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const getTimeParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const getAddisAbabaDateString = (date = new Date()) => {
  const { year, month, day } = getDateParts(date);
  return `${year}-${month}-${day}`;
};

const getAddisAbabaMinutes = (date = new Date()) => {
  const { hour, minute } = getTimeParts(date);
  return Number(hour) * 60 + Number(minute);
};

const createAddisAbabaDateTime = (date, hour, minute) => {
  const result = new Date(`${date}T00:00:00+03:00`);
  result.setUTCMinutes(result.getUTCMinutes() + (hour * 60) + minute);
  return result;
};

module.exports = {
  TIME_ZONE,
  getAddisAbabaDateString,
  getAddisAbabaMinutes,
  createAddisAbabaDateTime,
};
