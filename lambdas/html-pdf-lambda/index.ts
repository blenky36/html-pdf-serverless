import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda'
import { generatePdfBuffer } from './generatePdfBuffer'

// process.env.AWS_REGION is a default env var provided in lambdas by AWS
const s3Client = new S3Client({ region: process.env.AWS_REGION })

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
    if (!event.body) {
        return {
            statusCode: 400,
            body: "Invalid request body"
        }
    }
    try {
        const requestBody = JSON.parse(event.body) as { html: string, s3Key: string }

        const pdfBuffer = await generatePdfBuffer(requestBody.html)

        if(!pdfBuffer) {
            throw new Error('Failed to created PDF buffer from HTML')
        }

        const s3Upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.S3_PDF_BUCKET,
                Body: pdfBuffer,
                Key: requestBody.s3Key
            }
        })
        s3Upload.on("httpUploadProgress", (progress) => {
            console.log(progress);
        });
        await s3Upload.done()

        const presignedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: process.env.S3_PDF_BUCKET, Key: requestBody.s3Key }),
            { expiresIn: 3600 }
        )

        return {
            statusCode: 200,
            body: JSON.stringify({
                pdfUrl: presignedUrl
            })
        }
    } catch (error) {
        console.log("Error converting HTML to PDF", error)
        return {
            statusCode: 500,
            body: "Internal server error"
        }
    }
}
