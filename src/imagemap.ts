// This script is used to upload images to Cloud Storage for imagemap messages.
// We need to upload multiple size images for imagemap messages.

// Usage:
//   $ ts-node scripts/imagemap.ts --bucket <bucket name> --to <target path> --from <image path>

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

const convertImage = async (imagePath: string, targetDir: string) => {
  // Convert an image to multiple sizes for imagemap messages.
  // The image sizes are defined in https://developers.line.biz/en/reference/messaging-api/#imagemap-message
  // The image widths are 1040, 700, 460, 300, 240
  // This function will convert the image to the sizes and save them to the targetDir with its image width.

  const imageWidths = [1040, 700, 460, 300, 240];
  const imageFileExt = path.extname(imagePath);
  const imageFileNameWithoutExt = path.basename(imagePath, imageFileExt);
  const targetFiledir = path.join(targetDir, `${imageFileNameWithoutExt}`);
  if (!fs.existsSync(targetFiledir)) {
    fs.mkdirSync(targetFiledir, { recursive: true });
  }

  return Promise.all(imageWidths.map(async (width) => {
    const targetFilepath = path.join(targetFiledir, `${width}`);
    console.log(`Converting ${imagePath} to ${targetFilepath}`);
    await sharp(imagePath)
      .resize(width)
      .toFile(targetFilepath);
    return targetFilepath;
  }));
}

const upload = async (bucketName: string, targetPath: string, sourceFilePaths: readonly string[]) => {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  sourceFilePaths.map((sourceFilePath) => {
    console.log(`Uploading ${sourceFilePath} to gs://${bucketName}/${targetPath}/${path.basename(sourceFilePath)}`);
    bucket.upload(sourceFilePath, {
      destination: `${targetPath}/${path.basename(sourceFilePath)}`,
      contentType: 'image/png',
    });
  });
}

const main = async () => {
  const argv = await yargs
    .option('bucket', {
      alias: 'b',
      description: 'Bucket name',
      type: 'string',
    })
    .option('to', {
      alias: 't',
      description: 'Target path',
      type: 'string',
    })
    .option('from', {
      alias: 'f',
      description: 'Image path',
      type: 'string',
    })
    .demandOption(['bucket', 'to', 'from'])
    .help()
    .alias('help', 'h')
    .argv;

  const targetPath = argv.to;
  const imagePath = argv.from;

  if (!fs.existsSync(imagePath)) {
    console.error(`Image file not found: ${imagePath}`);
    return;
  }

  const tmpImagePath = path.join(
    path.dirname(imagePath),
    `tmp-${path.basename(imagePath, path.extname(imagePath))}`
  );
  if (!fs.existsSync(tmpImagePath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  // Convert image
  const convertedImageFilePaths = await convertImage(imagePath, tmpImagePath);

  // Upload
  await upload(argv.bucket, targetPath, convertedImageFilePaths);
};
main();