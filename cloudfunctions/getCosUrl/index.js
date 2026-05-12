const cloud = require('wx-server-sdk')
const COS = require('cos-nodejs-sdk-v5')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { bucket = 'gamebgm-1333103280', fileKey = 'cover1.mp3', region = 'ap-chengdu' } = event

  const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY,
  })

  const url = await new Promise((resolve, reject) => {
    cos.getObjectUrl({
      Bucket: bucket,
      Region: region,
      Key: fileKey,
      Protocol: 'https',
      Method: 'GET',
      Expires: 3600,
    }, (err, data) => {
      if (err) reject(err)
      else resolve(data.Url)
    })
  })

  return { url }
}
