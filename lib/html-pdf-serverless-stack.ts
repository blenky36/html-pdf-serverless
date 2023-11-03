import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';

export class HtmlPdfServerlessStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pdfsS3Bucket = new Bucket(this, 'PDFsS3Bucket')

    const chromeAwsLambdaLayer = new LayerVersion(this, 'ChromeAWSLambdaLayer', {
      layerVersionName: 'ChromeAWSLambdaLayer',
      compatibleRuntimes: [
        Runtime.NODEJS_18_X
      ],
      code: Code.fromAsset('chromium-v110.0.0-layer.zip')
    })

    const htmlToPdfLambda = new NodejsFunction(this, 'HtmlToPdfLambda', {
      entry: 'lambdas/html-pdf-lambda/index.ts',
      environment: {
        S3_PDF_BUCKET: pdfsS3Bucket.bucketName
      },
      layers: [chromeAwsLambdaLayer],
      bundling: {
        externalModules: [
          'aws-sdk'
        ],
        nodeModules: ['@sparticuz/chromium'],
      },
      timeout: Duration.seconds(30),
      runtime: Runtime.NODEJS_18_X,
      memorySize: 1024
    })
    pdfsS3Bucket.grantReadWrite(htmlToPdfLambda)

    const healthcheckLambda = new NodejsFunction(this, 'HealthcheckLambda', {
      entry: 'lambdas/healthcheck-lambda/index.ts'
    })

    const api = new RestApi(this, 'HtmlToPdfRestApi', {
      restApiName: 'HTML PDF API',
    })

    api.root.addMethod("GET", new LambdaIntegration(healthcheckLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    }))
    api.root.addMethod("POST", new LambdaIntegration(htmlToPdfLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    }))

  }
}


