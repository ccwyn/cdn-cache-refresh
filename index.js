"use strict";
const qiniu = require("qiniu");
const Core = require("@alicloud/pop-core");
const ora = require("ora");

// Uploading progress tip
const tip = (completeFiles, total) => {
  console.log("\n");
  let msg = `refresh to CDN:`;
  return `${msg} completeFiles: ${completeFiles} total: ${total}`;
};

const checkOptions = (options = {}) => {
  const type = Object.keys(options);
  let errStr = "";
  if (type.length === 0) {
    errStr = "\n type not specified";
    return errStr;
  }
  if (type.includes("qiniu")) {
    if (!options.qiniu.accessKey) errStr += "\n accessKey not specified";
    if (!options.qiniu.secretKey) errStr += "\n secretKey not specified";
    if (!options.qiniu.domain) errStr += "\n qiniu domain not specified";
    if (!options.qiniu.dist) errStr += "\n qiniu dist not specified";
  }
  if (type.includes("aliOss")) {
    if (!options.aliOss.accessKeyId) errStr += "\n accessKeyId not specified";
    if (!options.aliOss.accessKeySecret)
      errStr += "\n accessKeySecret not specified";
    if (!options.aliOss.domain) errStr += "\n aliOss domain not specified";
    if (!options.aliOss.dist) errStr += "\n aliOss dist not specified";
  }
  return errStr;
};

const chunk = (array, size) => {
  let [start, end, result] = [null, null, []];
  for (let i = 0; i < Math.ceil(array.length / size); i++) {
    start = i * size;
    end = start + size;
    result.push(array.slice(start, end));
  }
  return result;
};

const handlePaths = (domain, dist, filesNames) => {
  return filesNames.map((item) => `${domain}/${dist}/${item}`);
};
const sleep = async (millisecond = 200) => {
  return new Promise((res) => {
    setTimeout(() => {
      res();
    }, millisecond);
  });
};

class CdnCacheRefresh {
  constructor(options = {}) {
    this.config = JSON.parse(JSON.stringify(options));
    this.configErrStr = checkOptions(this.config);
    if (this.configErrStr) throw new Error(this.configErrStr);
    this.webPackFilesName = [];
    this.spinner = ora({ color: "green", text: "refresh cnd start" });
  }
  apply(compiler) {
    if (compiler) {
      this.doWithWebpack(compiler);
    } else {
      this.doWithoutWebpack();
    }
  }
  doWithWebpack(compiler) {
    compiler.hooks.assetEmitted.tapPromise("CdnCacheRefresh", (file) => {
      this.webPackFilesName.push(file);
      return Promise.resolve();
    });
    compiler.hooks.done.tapAsync(
      "CdnCacheRefresh",
      async (compilation, callback) => {
        this.doWithoutWebpack(callback);
      }
    );
  }
  async doWithoutWebpack(callback) {
    const type = Object.keys(this.config);
    for (var i = 0; i < type.length; i++) {
      this.spinner.start();
      try {
        if (type[i] == "qiniu") {
          await this.reFreshQnFiles(type[i]);
          await sleep(300);
        }
        if (type[i] == "aliOss") await this.reFreshAliOssFiles(type[i]);
      } catch (error) {
        throw new Error(error);
      }
    }
    this.spinner.succeed();
    callback && callback();
  }
  async reFreshAliOssFiles(type) {
    const {
      accessKeyId,
      accessKeySecret,
      domain,
      dist,
      endpoint,
      apiVersion,
      RegionId,
      ObjectType,
      filesNames,
    } = this.config[type];
    let client = new Core({
      accessKeyId: accessKeyId,
      accessKeySecret: accessKeySecret,
      endpoint: endpoint || "https://cdn.aliyuncs.com",
      apiVersion: apiVersion || "2018-05-10",
    });
    let requestOption = {
      method: "POST",
    };
    let params = {
      RegionId: RegionId || "cn-hangzhou",
      ObjectPath: "",
      ObjectType: ObjectType || "File",
    };
    let refreshUrls =
      filesNames && filesNames.length
        ? handlePaths(domain, dist, filesNames)
        : handlePaths(domain, dist, this.webPackFilesName);
    let objectPathSplit = chunk(refreshUrls, 999);
    let completeFiles = 0;
    for (var i = 0; i < objectPathSplit.length; i++) {
      try {
        params.ObjectPath = objectPathSplit[i].join("\\n");
        await client.request("RefreshObjectCaches", params, requestOption);
        completeFiles += objectPathSplit[i].length;
        this.text = tip(completeFiles, refreshUrls.length);
      } catch (error) {
        throw new Error(error);
      }
    }
  }
  async reFreshQnFiles(type) {
    const { accessKey, secretKey, domain, dist, filesNames } = this.config[
      type
    ];
    let mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    let cdnManager = new qiniu.cdn.CdnManager(mac);
    let refreshUrls =
      filesNames && filesNames.length
        ? handlePaths(domain, dist, filesNames)
        : handlePaths(domain, dist, this.webPackFilesName);
    let completeFiles = 0;
    let filesNamesSplit = chunk(refreshUrls, 99);
    // 刷新链接，单次请求链接不可以超过100个，如果超过，请分批发送请求
    for (var i = 0; i < filesNamesSplit.length; i++) {
      try {
        await this.cdnManagerPromise(filesNamesSplit[i], cdnManager);
        completeFiles += filesNamesSplit[i].length;
        this.spinner.text = tip(completeFiles, refreshUrls.length);
      } catch (error) {
        throw new Error(error);
      }
    }
  }
  async cdnManagerPromise(urlsToRefresh, cdnManager) {
    return new Promise((resolve, reject) => {
      cdnManager.refreshUrls(urlsToRefresh, (err, respBody, respInfo) => {
        if (err) reject(err);
        if (respInfo.statusCode == 200) {
          resolve(respBody);
        }
      });
    });
  }
}

module.exports = CdnCacheRefresh;
