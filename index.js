const AWS = require('aws-sdk');
AWS.config.update({
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbTableName = 'table-name';
const healthPath = '/test';
const employeePath = '/employee';
const employeesPath = '/employees';

exports.handler = async function (event) {
    console.log('Request event: ', event);

    let response;

    switch (true) {
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = responseBuilder(200);
            break;
        case event.httpMethod === 'GET' && event.path === employeesPath:
            response = await getEmployees();
            break;
        case event.httpMethod === 'GET' && event.path === employeePath:
            response = await getEmployee(event.queryStringParameters.employeeId);
            break;
        case event.httpMethod === 'POST' && event.path === employeePath:
            response = await createEmployee(JSON.parse(event.body));
            break;
        case event.httpMethod === 'PATCH' && event.path === employeePath:
            const requestBody = JSON.parse(event.body);
            response = await updateEmployee(requestBody.employeeId, requestBody.updateKey, requestBody.updateValue);
            break;
        case event.httpMethod === 'DELETE' && event.path === employeePath:
            response = await deleteEmployee(JSON.parse(event.body).employeeId);
            break;
        default:
            response = responseBuilder(404, '404 Not Found');
    }
    return response;
};

async function getEmployees() {
    const params = {
        TableName: dynamodbTableName,
    };
    const employeeList = await scanDynamoRecords(params, []);
    return responseBuilder(200, { employees: employeeList });
}

async function scanDynamoRecords(scanParams, itemArray) {
    try {
        const dynamoData = await dynamodb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if (dynamoData.LastEvaluatedKey) {
            scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
            return await scanDynamoRecords(scanParams, itemArray);
        }
        return itemArray;
    } catch (err) {
        errorHandle(err);
    }
}


async function getEmployee(employeeId) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'employeeId': employeeId
        }
    };
    return await dynamodb.get(params).promise().then(resp => {
        return responseBuilder(200, resp.Item);
    }, err => {
        errorHandle(err);
    });
}

async function createEmployee(requestBody) {
    const params = {
        TableName: dynamodbTableName,
        Item: requestBody
    };
    return await dynamodb.put(params).promise().then(() => {
        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: requestBody
        };
        return responseBuilder(200, body);
    }, (err) => {
        errorHandle(err);
    });
}


async function updateEmployee(employeeId, updateKey, updateValue) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'employeeId': employeeId
        },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAttributeValues: {
            ':value': updateValue
        },
        ReturnValues: 'UPDATED_NEW'
    };
    return await dynamodb.update(params).promise().then((response) => {
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            UpdatedAttributes: response
        };
        return responseBuilder(200, body);
    }, (err) => {
        errorHandle(err);
    });
}

async function deleteEmployee(employeeId) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'employeeId': employeeId
        },
        ReturnValues: 'ALL_OLD'
    };
    return await dynamodb.delete(params).promise().then((response) => {
        const body = {
            Operation: 'DELETE',
            Message: 'SUCCESS',
            Item: response
        };
        return responseBuilder(200, body);
    }, (err) => {
        errorHandle(err);
    });
}

function responseBuilder(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

function errorHandle(err) {
    console.error('Need error handler. For now just log: ', err);
}
