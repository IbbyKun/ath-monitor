'use strict';

const buildService = require('./services/build.service');
const buildValidator = require('./build.validation');
const { Storage } = require('@google-cloud/storage');

// Google Cloud Storage backs the agent-installer download only. Constructing the
// client at module load meant an unset BUCKET_NAME threw
// ("A bucket name is needed to use Cloud Storage") and took the ENTIRE admin
// service down at boot over one optional feature. Resolve it lazily instead, so
// only the handlers that actually touch GCS fail — and with a clear message.
const bucketName = process.env.BUCKET_NAME;

let storage;
function getBucket() {
    if (!bucketName) {
        throw new Error(
            'BUCKET_NAME is not configured — the agent installer download/upload ' +
            'is unavailable. Set BUCKET_NAME and provide storageconfig.json to enable it.'
        );
    }
    if (!storage) storage = new Storage({ keyFilename: 'storageconfig.json' });
    return storage.bucket(bucketName);
}

class BuildController {
    async add(req, res, next) {
        try {
            let data = await buildValidator.validateBuildInfoParams().validateAsync(req.body);
            return await buildService.add(data, res, next);
        } catch (error) {
            next(error);
        }
    }

    async craeteBuild(req, res, next) {
        try {
            const { email } = await buildValidator.createBuild().validateAsync(req.body);
            return await buildService.createBuild(email, res, next);
        } catch (error) {
            next(error);
        }
    }
    async addOnPremise(req, res, next) {
        try {
            let data = await buildValidator.addOnPremiseBuild().validateAsync(req.body);
            return await buildService.addOnPremise(data, res, next);
        } catch (error) {
            console.log(error)
            next(error);
        }
    }
    async uploadFile(req, res, next) {
        try {

            let { uniqueKey, secretKey } = req?.query;
            if (!uniqueKey) return res.status(400).json({ code: 400, message: 'uniqueKey is required' });
           
            if (secretKey !== process.env.ON_PREMISE_KEY) return res.status(400).json({ code: 400, message: 'not authorized' });
            if (!req.files) return res.status(400).json({ code: 400, message: 'file is required!!' });
            let item = req.files[0];
            let folderName = `EmpMonitor/${uniqueKey}`;
            let url = await uploadImage(item, folderName);
            if(url) return res.status(200).json({ code: 200, message: 'File Uploaded Successfully',url:url });

            else return  res.status(400).json({ code: 400, message: 'Error uploading file' });
        } catch (error) {
            return next(error);
        }
    }
    async fetchFiles(req, res, next) {

        try {
            let uniqueKey = req?.query?.uniqueKey;
            const url = `https://storage.googleapis.com/${bucketName}`

            let fileInfos = [];
            let options = {
                prefix:  `EmpMonitor/`,
                orderBy: '-updated',
            };
            if (uniqueKey) {
                options.prefix =  `EmpMonitor/${uniqueKey}/`;
            }
           
            const [files] = await getBucket().getFiles(options);
           
            files.forEach((file) => {
                fileInfos.push({
                    fileName: file.name,
                    viweLinkURL: `${url}/${file.name}`,
                    downloadLinkUrl: file.metadata.mediaLink,
                });
            });

            fileInfos.length ?  res.status(200).json({ code: 200, message: 'Files Fetched Successfully', fileInfos })
                :  res.status(400).json({ code: 400, message: 'Failed to Fetch files' })
        } catch (err) {
            return next(err);
        }
    }
}

module.exports = new BuildController;

const uploadImage = (file, folderName) =>
    new Promise(async (resolve, reject) => {
        
        const { originalname, buffer } = file;
        try {
            const blob = getBucket().file(`${folderName}/${originalname.replace(/ /g, '_')}`);
            const blobStream = blob.createWriteStream({
                resumable: false,
            });

            blobStream
                .on('finish', async () => {
                    const options = {
                        entity: 'allUsers',
                        role: storage.acl.READER_ROLE,
                      };
            
                    try {
                        await blob.acl.add(options);
                        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;

                        resolve(publicUrl);
                    } catch (aclError) {
                        reject(`Error applying ACL: ${aclError}`);
                    }
                })
                .on('error', (err) => {
                    reject(`Unable to upload file, something went wrong: ${err}`);
                })
                .end(buffer);
        } catch (err) {
            reject(`Error uploading image: ${err}`);
        }
    });