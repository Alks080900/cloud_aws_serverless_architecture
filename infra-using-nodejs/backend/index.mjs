import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({ region: process.env.region });
const dynamoDB = new DynamoDBClient({ region: process.env.region });
const bucketName = process.env.bucket_name;
const DYNAMODB_TABLE_NAME = process.env.table_name;


const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex'); 
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash }; // Return the salt and the hashed password
};


const createToken = (email) => {
    const timestamp = new Date().toISOString();
    const token = Buffer.from(`${email}:${timestamp}`).toString('base64');
    return token; // Return the base64 encoded token
};

export const handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    try {
        // Handle CORS preflight request
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            };
        }

        switch (event.httpMethod) {
            case 'POST':
                if (event.path === '/signup') {
                    return await signUp(event);
                } else if (event.path === '/login') {
                    return await login(event);
                } else {
                    return {
                        statusCode: 404,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type',
                        },
                        body: JSON.stringify({ message: 'Not Found' }),
                    };
                }
                break;
            case 'PUT':
                if (event.path === '/updateProfileImage') {
                    return await updateProfileImage(event);
                }
                break;
            default:
                return {
                    statusCode: 405,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                    },
                    body: JSON.stringify({ message: 'Method Not Allowed' }),
                };
        }
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ error: error.message }),
        };
    }
};

const signUp = async (event) => {
    const { filename, contentType, email, name, password } = JSON.parse(event.body);
    console.log(filename, contentType, email, name, password);

    const uploadParams = {
        Bucket: bucketName,
        Key: filename,
        ContentType: contentType,
    };
    const command = new PutObjectCommand(uploadParams);
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 });

    const { salt, hash } = hashPassword(password);

    const timestamp = new Date().toISOString();
    const item = {
        email: { S: email },
        name: { S: name },
        password: { S: hash },
        salt: { S: salt },
        profile_image: { S: `https://${bucketName}.s3.amazonaws.com/${filename}` },
        datetime: { S: timestamp },
    };

    await dynamoDB.send(new PutItemCommand({
        TableName: DYNAMODB_TABLE_NAME,
        Item: item,
    }));

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ uploadURL }),
    };
};

const login = async (event) => {
    console.log("Login attempt:", JSON.stringify(event.body));

    try {
        const { email, password } = JSON.parse(event.body);
        console.log("Email:", email, "Password:", password);

        const userData = await dynamoDB.send(new GetItemCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Key: {
                email: { S: email },
            },
        }));

        if (!userData.Item) {
            console.log("User not found in DynamoDB");
            return {
                statusCode: 401, // Unauthorized
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({ message: 'Invalid email or password' }),
            };
        }

        const storedHash = userData.Item.password.S;
        const storedSalt = userData.Item.salt.S;
        console.log("Stored password hash from DynamoDB:", storedHash);

        const { hash } = hashPasswordWithSalt(password, storedSalt);

        if (hash !== storedHash) {
            console.log("Password mismatch");
            return {
                statusCode: 401, // Unauthorized
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({ message: 'Invalid email or password' }),
            };
        }

        const token = createToken(email);
        const profileImageUrl = userData.Item.profile_image.S;
        console.log("Login successful for user:", email);
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ message: 'Login successful', email, profileImageUrl, token }), 
        };

    } catch (error) {
        console.error("Error during login process:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ error: error.message }),
        };
    }
};

const hashPasswordWithSalt = (password, salt) => {
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { hash };
};

const updateProfileImage = async (event) => {
    const { email, oldImageKey, newFilename, newContentType } = JSON.parse(event.body);
    const deleteParams = {
        Bucket: bucketName,
        Key: oldImageKey,
    };
    await s3.send(new DeleteObjectCommand(deleteParams));

    const uploadParams = {
        Bucket: bucketName,
        Key: newFilename,
        ContentType: newContentType,
    };
    const command = new PutObjectCommand(uploadParams);
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 });

    const updateParams = {
        TableName: DYNAMODB_TABLE_NAME,
        Key: {
            email: { S: email },
        },
        UpdateExpression: "SET profile_image = :newImage",
        ExpressionAttributeValues: {
            ":newImage": { S: `https://${bucketName}.s3.amazonaws.com/${newFilename}` },
        },
    };

    await dynamoDB.send(new UpdateItemCommand(updateParams));

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ uploadURL }),
    };
};
