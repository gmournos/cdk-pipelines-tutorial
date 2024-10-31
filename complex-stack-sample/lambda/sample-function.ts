import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Create an S3 client instance
const s3Client = new S3Client({});

export const writeRandomToS3 = async (event: any) => {
  const bucketName = process.env.BUCKET_NAME;
  // this can be easier done by using crypto.randomUUID()
  // using uuid here only in order to have an external dependency that will create an asset during cdk deployment
  
  const key = `test-file-${uuidv4()}.txt`; 

  // Parameters for uploading the object to S3
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: 'Hello from Lambda using AWS SDK v3!',
  };

  // Use AWS SDK v3 to put the object in S3
  try {
    const result = await s3Client.send(new PutObjectCommand(params));
    return {
      statusCode: 200,
      body: `File created with key: ${key}, result: ${JSON.stringify(result)}`,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: 'Error: ',
    };
  }
};
