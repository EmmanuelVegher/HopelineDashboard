import { createCipheriv } from 'crypto';

var ErrorCode;
(function (ErrorCode) {
  ErrorCode[(ErrorCode['success'] = 0)] = 'success';
  ErrorCode[(ErrorCode['appIDInvalid'] = 1)] = 'appIDInvalid';
  ErrorCode[(ErrorCode['userIDInvalid'] = 3)] = 'userIDInvalid';
  ErrorCode[(ErrorCode['secretInvalid'] = 5)] = 'secretInvalid';
  ErrorCode[(ErrorCode['effectiveTimeInSecondsInvalid'] = 6)] = 'effectiveTimeInSecondsInvalid';
})(ErrorCode || (ErrorCode = {}));

function rndNum(a, b) {
  return Math.ceil((a + (b - a)) * Math.random());
}

function makeNonce() {
  return rndNum(-2147483648, 2147483647);
}

function makeRandomIv() {
  const str = '0123456789abcdefghijklmnopqrstuvwxyz';
  const result = [];
  for (let i = 0; i < 16; i++) {
    const r = Math.floor(Math.random() * str.length);
    result.push(str.charAt(r));
  }
  return result.join('');
}

function getAlgorithm(keyBase64) {
  const key = Buffer.from(keyBase64);
  switch (key.length) {
    case 16:
      return 'aes-128-cbc';
    case 24:
      return 'aes-192-cbc';
    case 32:
      return 'aes-256-cbc';
    default:
      throw new Error('Invalid key length: ' + key.length);
  }
}

function aesEncrypt(plainText, key, iv) {
  const cipher = createCipheriv(getAlgorithm(key), key, iv);
  cipher.setAutoPadding(true);
  const encrypted = cipher.update(plainText);
  const final = cipher.final();
  const out = Buffer.concat([encrypted, final]);
  return Uint8Array.from(out).buffer;
}

export function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload = '') {
  if (!appId || typeof appId !== 'number') {
    throw { errorCode: ErrorCode.appIDInvalid, errorMessage: 'appID invalid' };
  }
  if (!userId || typeof userId !== 'string') {
    throw { errorCode: ErrorCode.userIDInvalid, errorMessage: 'userId invalid' };
  }
  if (!secret || typeof secret !== 'string' || secret.length !== 32) {
    throw { errorCode: ErrorCode.secretInvalid, errorMessage: 'secret must be a 32 byte string' };
  }
  if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
    throw {
      errorCode: ErrorCode.effectiveTimeInSecondsInvalid,
      errorMessage: 'effectiveTimeInSeconds invalid'
    };
  }

  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: makeNonce(),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload
  };
  const plainText = JSON.stringify(tokenInfo);
  const iv = makeRandomIv();
  const encryptBuf = aesEncrypt(plainText, secret, iv);

  const b1 = new Uint8Array(8);
  const b2 = new Uint8Array(2);
  const b3 = new Uint8Array(2);
  new DataView(b1.buffer).setBigInt64(0, BigInt(tokenInfo.expire), false);
  new DataView(b2.buffer).setUint16(0, iv.length, false);
  new DataView(b3.buffer).setUint16(0, encryptBuf.byteLength, false);
  const buf = Buffer.concat([
    Buffer.from(b1),
    Buffer.from(b2),
    Buffer.from(iv),
    Buffer.from(b3),
    Buffer.from(encryptBuf)
  ]);
  const dv = new DataView(Uint8Array.from(buf).buffer);
  return '04' + Buffer.from(dv.buffer).toString('base64');
}

