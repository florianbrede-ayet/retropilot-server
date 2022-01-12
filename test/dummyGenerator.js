
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const devicePrivateKey = "-----BEGIN RSA PRIVATE KEY-----\n" +
    "MIIEowIBAAKCAQEAwhH9PqBd/R/QPvcf1Gom5Vp+zYb1+DLjiFMC7a1lNvV8MUqK\n" +
    "cKVzboq/TjkKxkPUxRRjhgt4TmxhxJ6AHAOvONMvXtS1gm8EuiJbzSUDbgr6Y3PV\n" +
    "/jHQEb8tWcmM5UZ4TV+VPBmY4w9UWJbCiJW1Udn253bqil3Mv2D4WjpxlQDNGmpc\n" +
    "Aq0b7N20WoMt/DB3Z/AnixYKLGDLmHIe8Umq9btFPv/ulVexuzeoJoYjMZLDv4Sf\n" +
    "SE4ONmDqAacjTtBPaEFedlerKVMN0PI2IzDeGvEqif98lEEVh4/3X1UP21A2Cgiy\n" +
    "nHQn92HRTR8Xkc5EYDOYEpwi97G6g+qaFtOacQIDAQABAoIBAQCFtuVZGB+KPzg5\n" +
    "mgXZUkZ4cnC55YpmN5HkJOX4oycAxgWK5MQcNzMgcAK9v7m3v5bDL3gfLJn41t5K\n" +
    "HbdBFhzNt1yFJ2Pked+06+V6pE0HrhK1IWPJH8Mv5xw1KBSnCHXtQbVOUoivsak4\n" +
    "3K8ucpAa1GY1Nw8ExPpExmh3qpsFwPFFq3ZkDdGPaxQdOGzrNwC9Z6R+XNEdh+Ub\n" +
    "N6On3McK+AmI4deW5GWdL54vHsC0MfWhdWMklPcw98o9ZVQ9V6Bzf8tRIBVB4qRB\n" +
    "pyQaRRPmkpX0s5mNCAZljLxyO1oD0yfugSZOnbbmo47BmYQiNd1WfxVXwMqR0dNE\n" +
    "js4HCW7BAoGBAPrMOFlsYpP3DLOXSHQwt+ZGcnh54NJcz97KJKQRE93H4pVUcnsn\n" +
    "VhgNTq1bYkw8CdFpPJgQgeBeX4djDyfFYEDYQnmAi0hcIFuwEV8U8LYsp7EyLWVA\n" +
    "pR+vtj5mIkdZ/j4jsYAMrQbwbweptxWiOeGqGr7vGzxOXBLDS9W4FZNZAoGBAMYY\n" +
    "iU58TTWPdUllkvxPToXv6+tjognnbatYxzrwiRRKlAuc6JPZP3qADhJ7SZNxaB88\n" +
    "aun+GZEwOITCZHkKl5oSyshb0mp9SIWlG7Nkn08/8464eAJbk7tNwtdOAHdbzKS0\n" +
    "LXpNlQ9ZGy36vE6KtGctPfGY5H4r8uIX+SlmJNTZAoGAMDDnrv8tngL9tNCgAnuO\n" +
    "CriErHO26JUe+E9dZQ1HBPmwp0MX0GRJncuIz7TcmYt703pmQ04Ats1Li+dT9S9v\n" +
    "BGbJtzElEl1pdlTJsbyDWG4SNvFOWcNnN0R7P1g+w/kd6nDPXayR3uB6ZT2OSaDn\n" +
    "gF5AT2oAkMD53j0aqFF8C9kCgYB2pTN3wpMrxSRmNWP3ojhRmAUhEqd2bxoMSjvp\n" +
    "XS98674Hxo62HqQaZqAHCbhjisTmEHWod/wwLUVsnlE2/dUW/rJdlkFMboUFJoKU\n" +
    "y2tvN8pUbL/UCa1NvaE4+wrkciL7cr7aRaVFcAULYOVv1Tt/oGU9Umln+EKcj+c3\n" +
    "mGnu4QKBgBq7yEEj99q4BoK0DhS9t/Y/akN60rPrkOetxgbpSgvLifictFg9Og0p\n" +
    "empY8kk3cQACUIKoLkbrx7mOrC/MUFWZ7H4/65QxvJWsyVvdgD3JCuX6gntgxFLR\n" +
    "gELymgXiYG6TBxfH6xcFtNrFe6DeTv8YXrKRR50Kg8kjFpvmm5s9\n" +
    "-----END RSA PRIVATE KEY-----\n"
const devicePubKey = "-----BEGIN PUBLIC KEY-----\n" +
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwhH9PqBd/R/QPvcf1Gom\n" +
    "5Vp+zYb1+DLjiFMC7a1lNvV8MUqKcKVzboq/TjkKxkPUxRRjhgt4TmxhxJ6AHAOv\n" +
    "ONMvXtS1gm8EuiJbzSUDbgr6Y3PV/jHQEb8tWcmM5UZ4TV+VPBmY4w9UWJbCiJW1\n" +
    "Udn253bqil3Mv2D4WjpxlQDNGmpcAq0b7N20WoMt/DB3Z/AnixYKLGDLmHIe8Umq\n" +
    "9btFPv/ulVexuzeoJoYjMZLDv4SfSE4ONmDqAacjTtBPaEFedlerKVMN0PI2IzDe\n" +
    "GvEqif98lEEVh4/3X1UP21A2CgiynHQn92HRTR8Xkc5EYDOYEpwi97G6g+qaFtOa\n" +
    "cQIDAQAB\n" +
    "-----END PUBLIC KEY-----\n";
const rougePublicKey = "-----BEGIN PUBLIC KEY-----\n" +
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsD2nKi9wqmib8kEAuyz7\n" +
    "6N2OiL5ZpCkgai02V0G/cHUdkQXGxw0gWnYaDmY4uhgQM4W1jpHkwLW3PXavyDYE\n" +
    "mCeORRS2ChYqPpJJkSQ+MO1bkR1blhixF6O39gIH5+0ZuiqnDYJIcn+DcYJrTzCz\n" +
    "HXyPvRztFuuKp1unJRi8cSL6ljq5LMjZLsuY9Eb7JmYRsXB/xHDpXysyqq1VGD5c\n" +
    "QSCJMFzykQUe4PR3AhP05SunJMA+QNhRxKUVzXyo3bpAXsRhhRr/E/jl48E22edl\n" +
    "cgXar6R9CxyHY31jdJnd9pp2KPUnNgnTBdF2w3pdN9frS9QHCDLDvLbCgd2bibSj\n" +
    "CwIDAQAB\n" +
    "-----END PUBLIC KEY-----"

const alreadyRegisteredEmail = "adam@adamblack.us"
const newUserEmail = "newUser@retropilot.com"

function makeJWT() {
    const token = jwt.sign({ register: true  }, devicePrivateKey, { algorithm: 'RS256'});
    return `JWT ${token}`
}

function getImei() {
    return parseInt(Math.random().toFixed(15).replace("0.",""))
}

function getSerial() {
    return crypto.randomBytes(10).toString('hex');
}



export default {
    makeJWT, getImei, getSerial, rougePublicKey, devicePubKey, devicePrivateKey, alreadyRegisteredEmail, newUserEmail
};