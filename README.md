cdn-cache-refresh
====================

> 刷新 七牛/OSS CDN节点上的文件内容，可以作为webpack插件使用，也可独立使用

## 前提

需要 Node 版本在 v8.0 以上

## 安装

```sh
npm i -D cdn-cache-refresh
```

## 使用方法

支持的配置项:
- `type` 要刷新的平台类型 ['qiniu','ali-oss']
- type传入qiniu
  - `accessKey` 七牛 AccessKey 必填
  - `secretKey` 七牛 SecretKey 必填
  - `qnCdnDomain`七牛加速域名 必填
  - `qnDist` 刷新oss哪个目录下，可作为路径前缀使用。必填
  - `qnFilesNames` 要刷新的URL文件名 数组格式 选填 (独立使用时必填) 
- type传入ali-oss
  - `accessKeyId` 阿里云的授权accessKeyId 必填
  - `accessKeySecret` 阿里云的授权accessKeySecret 必填
  - `aliCdnDomain`阿里云加速域名 必填
  - `aliDist` 刷新oss哪个目录下，可作为路径前缀使用。必填
  - `aliFilesNames` 要刷新的URL文件名 数组格式 选填 (独立使用时必填) 
  - `endpoint` 接入地址，默认为https://cdn.aliyuncs.com 选填
  - `apiVersion` 使用的API版本,默认为目前CDN的API版本2018-05-10 选填
  - `ObjectType`  阿里云刷新的类型,File(默认值):文件,Directory:目录 选填
  - `RegionId`  阿里云-WAF管控区域,cn-hangzhou(默认值):WAF中国内地管控区域,ap-southeast-1:WAF非中国内地 选填
   

## Example
#### 作为webpack插件使用
```
// 引入
const CdnCacheRefresh = require('cdn-cache-refresh');

// 配置 Plugin
const CdnCacheRefresh = new CdnCacheRefresh({
  type: ['qiniu','ali-oss'],
  accessKey: "xxx",
  secretKey: "xxx",
  qnCdnDomain:'https://www.xx.com',
  qnDist:"dist/sss",
  accessKeyId: "xxx",
  accessKeySecret: "xxx",
  aliCdnDomain:'https://www.xx.com',
  aliDist:"dist/sss",
});

// Webpack 的配置
module.exports = {
 plugins: [
   CdnCacheRefresh
 ]
}
```
#### 独立使用
```
const CdnCacheRefresh = require('cdn-cache-refresh');
new CdnCacheRefresh({
  type: ['qiniu','ali-oss'],
  accessKey: "xxx",
  secretKey: "xxx",
  qnCdnDomain:'https://www.xx.com',
  qnDist:"dist/sss",
  qnFilesNames:['750.js','751.js'],
  accessKeyId: "xxx",
  accessKeySecret: "xxx",
  aliCdnDomain:'https://www.xx.com',
  aliDist:"dist/sss",
  aliFilesNames:['750.js','751.js'],
}).apply(); 
```

