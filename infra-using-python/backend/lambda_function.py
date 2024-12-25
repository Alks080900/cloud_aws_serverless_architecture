import json
import boto3
import hashlib
import base64
import secrets
from datetime import datetime

s3_client = boto3.client('s3')
dynamodb_client = boto3.client('dynamodb')

DYNAMODB_TABLE_NAME = 'UsersPython'
S3_BUCKET_NAME = 'profile-images-auth-app'

def hash_password(password):
    salt = secrets.token_hex(16) 
    hash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 1000)
    return salt, hash.hex()
lt
def hash_password_with_salt(password, salt):
    hash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 1000)
    return hash.hex()

def create_token(email):
    timestamp = datetime.utcnow().isoformat()
    token = base64.b64encode(f'{email}:{timestamp}'.encode('utf-8')).decode('utf-8')
    return token

def lambda_handler(event, context):
    try:
        # Handle CORS preflight request
        if event['httpMethod'] == 'OPTIONS':
            return {
                'statusCode': 204,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            }

        if event['httpMethod'] == 'POST':
            if event['path'] == '/signup':
                return sign_up(event)
            elif event['path'] == '/login':
                return login(event)
            else:
                return not_found_response()
        
        elif event['httpMethod'] == 'PUT':
            if event['path'] == '/updateProfileImage':
                return update_profile_image(event)

        return method_not_allowed_response()

    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(str(e))

def sign_up(event):
    body = json.loads(event['body'])
    email = body['email']
    name = body['name']
    password = body['password']
    filename = body['filename']
    content_type = body['contentType']

    salt, password_hash = hash_password(password)

    timestamp = datetime.utcnow().isoformat()
    item = {
        'email': {'S': email},
        'name': {'S': name},
        'password': {'S': password_hash},
        'salt': {'S': salt},
        'profile_image': {'S': f'https://{S3_BUCKET_NAME}.s3.amazonaws.com/{filename}'},
        'datetime': {'S': timestamp},
    }

    dynamodb_client.put_item(TableName=DYNAMODB_TABLE_NAME, Item=item)

    upload_params = {
        'Bucket': S3_BUCKET_NAME,
        'Key': filename,
        'ContentType': content_type
    }
    presigned_url = s3_client.generate_presigned_url('put_object', Params=upload_params, ExpiresIn=3600)

    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps({'uploadURL': presigned_url}),
    }

def login(event):
    body = json.loads(event['body'])
    email = body['email']
    password = body['password']

    response = dynamodb_client.get_item(
        TableName=DYNAMODB_TABLE_NAME,
        Key={'email': {'S': email}}
    )

    if 'Item' not in response:
        return error_response('Invalid email or password')

    user = response['Item']
    stored_hash = user['password']['S']
    stored_salt = user['salt']['S']

    if hash_password_with_salt(password, stored_salt) != stored_hash:
        return error_response('Invalid email or password')

    token = create_token(email)
    profile_image_url = user['profile_image']['S']
    
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps({
            'message': 'Login successful',
            'email': email,
            'profileImageUrl': profile_image_url,
            'token': token
        }),
    }

def update_profile_image(event):
    body = json.loads(event['body'])
    email = body['email']
    old_image_key = body['oldImageKey']
    new_filename = body['newFilename']
    new_content_type = body['newContentType']

    s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=old_image_key)

    upload_params = {
        'Bucket': S3_BUCKET_NAME,
        'Key': new_filename,
        'ContentType': new_content_type
    }
    presigned_url = s3_client.generate_presigned_url('put_object', Params=upload_params, ExpiresIn=3600)

    dynamodb_client.update_item(
        TableName=DYNAMODB_TABLE_NAME,
        Key={'email': {'S': email}},
        UpdateExpression="SET profile_image = :newImage",
        ExpressionAttributeValues={
            ':newImage': {'S': f'https://{S3_BUCKET_NAME}.s3.amazonaws.com/{new_filename}'}
        }
    )

    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps({'uploadURL': presigned_url}),
    }

def not_found_response():
    return {
        'statusCode': 404,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps({'message': 'Not Found'}),
    }

def method_not_allowed_response():
    return {
        'statusCode': 405,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps({'message': 'Method Not Allowed'}),
    }

def error_response(message):
    return {
        'statusCode': 500,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps({'error': message}),
    }

