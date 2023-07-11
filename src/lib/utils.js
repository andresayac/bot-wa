const { http, https } = followRedirects;
import { rename, createWriteStream, existsSync } from 'fs'
import { tmpdir } from 'os'
import followRedirects from 'follow-redirects';
import path from 'path';
import crypto from 'crypto';


// These are utility functions
export default utils = {
    formatPhone: (contact, full = false) => {
        let domain = contact.includes('@g.us') ? '@g.us' : '@s.whatsapp.net';
        contact = contact.replace(domain, '');
        return !full ? `${contact}${domain}` : contact;
    },
    generateRefprovider: (prefix = '') => prefix ? `${prefix}_${crypto.randomUUID()}` : crypto.randomUUID(),
    isValidNumber: (rawNumber) => !rawNumber.match(/\@g.us\b/gm),
    prepareMedia: (media) => {
        if (isUrl(media)) {
            return { url: media };
        } else {
            try {
                return { buffer: readFileSync(media) };
            } catch (e) {
                console.error(`Failed to read file at ${media}`, e);
                throw e;
            }
        }
    },
    generalDownload: async (url) => {
        const checkIsLocal = existsSync(url)

        const handleDownload = () => {
            const checkProtocol = url.includes('https:')
            const handleHttp = checkProtocol ? https : http

            const name = `tmp-${Date.now()}-dat`
            const fullPath = `${tmpdir()}/${name}`
            const file = createWriteStream(fullPath)

            if (checkIsLocal) {
                /**
                 * From Local
                 */
                return new Promise((res) => {
                    const response = {
                        headers: {
                            'content-type': mime.contentType(extname(url)),
                        },
                    }
                    res({ response, fullPath: url })
                })
            } else {
                /**
                 * From URL
                 */
                return new Promise((res, rej) => {
                    handleHttp.get(url, function (response) {
                        response.pipe(file)
                        file.on('finish', async function () {
                            file.close()
                            res({ response, fullPath })
                        })
                        file.on('error', function () {
                            file.close()
                            rej(null)
                        })
                    })
                })
            }
        }

        const handleFile = (pathInput, ext) =>
            new Promise((resolve, reject) => {
                const fullPath = `${pathInput}.${ext}`
                rename(pathInput, fullPath, (err) => {
                    if (err) reject(null)
                    resolve(fullPath)
                })
            })

        const httpResponse = await handleDownload()
        const { ext } = await utils.fileTypeFromFile(httpResponse.response)
        const getPath = await handleFile(httpResponse.fullPath, ext)

        return getPath
    },
    convertAudio: async (filePath = null, format = 'opus') => {
        const formats = {
            mp3: {
                code: 'libmp3lame',
                ext: 'mp3',
            },
            opus: {
                code: 'libopus',
                ext: 'opus',
            },
        }

        const opusFilePath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.${formats[format].ext}`)
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .audioCodec(formats[format].code)
                .audioBitrate('64k')
                .format(formats[format].ext)
                .output(opusFilePath)
                .on('end', resolve)
                .on('error', reject)
                .run()
        })
        return opusFilePath
    },
    fileTypeFromFile: async (response) => {
        const type = response.headers['content-type'] ?? null
        const ext = mime.extension(type)
        return {
            type,
            ext,
        }
    }
}
