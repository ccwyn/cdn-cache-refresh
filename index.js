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
  const { type } = options;
  let errStr = "";
  if (!type || type.length === 0) {
    errStr = "\ntype not specified";
    return errStr;
  }
  if (type.includes("qiniu")) {
    if (!options.accessKey) errStr += "\naccessKey not specified";
    if (!options.secretKey) errStr += "\nsecretKey not specified";
    if (!options.qnCdnDomain) errStr += "\nqnCdnDomain not specified";
    if (!options.qnDist) errStr += "\nqnDist not specified";
  }
  if (type.includes("ali-oss")) {
    if (!options.accessKeyId) errStr += "\naccessKeyId not specified";
    if (!options.accessKeySecret) errStr += "\naccessKeySecret not specified";
    if (!options.aliCdnDomain) errStr += "\naliCdnDomain not specified";
    if (!options.aliDist) errStr += "\naliDist not specified";
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

class CdnCacheRefresh {
  constructor(options) {
    this.config = Object.assign({}, options);
    this.configErrStr = checkOptions(options);
    if (this.configErrStr) throw new Error(this.configErrStr);
  }
  apply(compiler) {
    const filesNames = [];
    const spinner = ora({
      color: "green",
      text: "=====refresh cnd start=====",
    }).start();
    const refreshUrlsQn = (urlsToRefresh, cdnManager) => {
      return new Promise((resolve, reject) => {
        cdnManager.refreshUrls(urlsToRefresh, (err, respBody, respInfo) => {
          if (err) reject(err);
          if (respInfo.statusCode == 200) {
            resolve(respBody);
          }
        });
      });
    };
    const doWithWebpack = async (compilation, callback) => {
      const { type } = this.config;
      for (var i = 0; i < type.length; i++) {
        try {
          await reFreshFiles(type[i]);
        } catch (error) {
          throw new Error(error);
        }
      }
      spinner.succeed();
      callback();
    };
    const doWithoutWebpack = async () => {
      const { type } = this.config;
      for (var i = 0; i < type.length; i++) {
        try {
          await reFreshFiles(type[i]);
        } catch (error) {
          throw new Error(error);
        }
      }
      spinner.succeed();
    };
    const reFreshFiles = async (type) => {
      if (type.includes("qiniu")) {
        const {
          accessKey,
          secretKey,
          qnCdnDomain,
          qnDist,
          qnFilesNames,
        } = this.config;
        let mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        let cdnManager = new qiniu.cdn.CdnManager(mac);
        let refreshUrls =
          qnFilesNames && qnFilesNames.length
            ? handlePaths(qnCdnDomain, qnDist, qnFilesNames)
            : handlePaths(qnCdnDomain, qnDist, filesNames);
        let filesTotal = refreshUrls.length;
        let completeFiles = 0;
        let filesNamesSplit = chunk(refreshUrls, 99);
        // 刷新链接，单次请求链接不可以超过100个，如果超过，请分批发送请求
        for (var i = 0; i < filesNamesSplit.length; i++) {
          try {
            const data = await refreshUrlsQn(filesNamesSplit[i], cdnManager);
            completeFiles += filesNamesSplit[i].length;
            spinner.text = tip(completeFiles, filesTotal);
          } catch (error) {
            throw new Error(error);
          }
        }
      }
      if (type.includes("ali-oss")) {
        const {
          accessKeyId,
          accessKeySecret,
          aliCdnDomain,
          aliDist,
          endpoint,
          apiVersion,
          RegionId,
          ObjectType,
          aliFilesNames,
        } = this.config;
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
          aliFilesNames && aliFilesNames.length
            ? handlePaths(aliCdnDomain, aliDist, aliFilesNames)
            : handlePaths(aliCdnDomain, aliDist, filesNames);
        let filesTotal = refreshUrls.length;
        let objectPathSplit = chunk(refreshUrls, 999);
        let completeFiles = 0;
        for (var i = 0; i < objectPathSplit.length; i++) {
          try {
            params.ObjectPath = objectPathSplit[i].join("\\n");
            console.log(params.ObjectPath);
            const data = await client.request(
              "RefreshObjectCaches",
              params,
              requestOption
            );
            completeFiles += objectPathSplit[i].length;
            spinner.text = tip(completeFiles, filesTotal);
          } catch (error) {
            throw new Error(error);
          }
        }
      }
    };
    if (compiler) {
      const getFilesNameByWebpack = (file) => {
        filesNames.push(file);
        return Promise.resolve();
      };
      compiler.hooks.assetEmitted.tapPromise(
        "CdnCacheRefresh",
        getFilesNameByWebpack
      );
      compiler.hooks.done.tapAsync("CdnCacheRefresh", doWithWebpack);
    } else {
      doWithoutWebpack();
    }
  }
}

module.exports = CdnCacheRefresh;
