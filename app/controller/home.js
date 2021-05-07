const { Controller } = require('egg');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const _ = require('lodash');

class HomeController extends Controller {
  async index() {
    const { action = '' } = this.ctx.request.query;
    if (action === 'get') {
      const res = await this.getBuySaleData();
      this.ctx.body = res;
      return;
    }
    this.ctx.body = '-----';
    // const res = await this.ctx.service.fundEastmoney.getDailyData('160127', '2021-01-01', '2021-05-01');
    // const res = await this.getRangeMinMax('160127', '2020-05-01');
    const res = await this.findData();
    this.ctx.body = res;
  }
  async getAll() {
    const data = await this.ctx.service.fundEastmoney.getAllCodes();
    this.ctx.body = JSON.stringify(data);
  }
  /**
   * 获取基金列表
   * 参数
      类型ft：all-全部 gp-股票型 hh-混合型 zq-债券型 zs-指数型 qdii-QDII lof-LOF fof-FOF
      排序键值sc：dm-代码 jc-简称 jzrq-日期 dwjz-单位净值 rzdf-日增长率 ljjz-累计净值
        zzf-这周 1yzf-1月 3yzf-3月 6yzf-6月 1nzf-1年 2nzf-2年 3nzf-3年 jnzf-今年 lnzf-成立
      排序st：desc-降序 asc-升序
      起始日期sd：2010-01-01
      结束日期ed：2021-05-01
      每页数量pn：1500
      页码pi：1
      是否可购dx：1-是 0-否
      例：/list?ft=all&sc=6yzf&st=desc&sd=2010-01-01&ed=2021-05-01&dx=1&pn=15&pi=1
   * @returns
   */
  async list() {
    const {ft = 'all', sc = '3nzf', st = 'desc', sd = '2021-04-01', ed = '2021-04-01', pn = 3, dx = 1, pi = 1} = this.ctx.query;
    const res = await this.ctx.service.fundEastmoney.getList(ft, sc, st, sd, ed, pn, dx, pi);
    this.ctx.body = JSON.stringify(res);
  }
  async info() {
    const { code = '00001' } = this.ctx.request.body;
    const res = await this.ctx.service.fundEastmoney.getInfo(code);
    this.ctx.body = JSON.stringify(res);
  }
  async dailyData() {
    const { code = '00001', startDate = '2021-04-01', endDate = '2021-04-30', per = 31 } = this.ctx.request.body;
    const res = await this.ctx.service.fundEastmoney.getDailyData(code, startDate, endDate, per);
    this.ctx.body = JSON.stringify(res);
  }
  /**
   * 获取买卖参考数据
   * @returns
   */
  async getBuySaleData() {
    const file = path.resolve(__dirname, `../data/busa_${moment().format('YYYYMMDD')}.json`);
    if (fs.existsSync(file)) {
      const str = fs.readFileSync(file).toString();
      const list = JSON.parse(str);
      return {list, count: list.length};
    }
    const listRes = await this.findData();
    const graphArr = await this.getGraphData(listRes.list.map((v) => v[0]));
    const buy1m = [];
    const buy3m = [];
    const buy6m = [];
    const buy1y = [];
    const sale1m = [];
    const sale3m = [];
    const sale6m = [];
    const sale1y = [];
    const buyDate = { buy1m, buy3m, buy6m, buy1y };
    const saleDate = { sale1m, sale3m, sale6m, sale1y };
    graphArr.forEach((v) => {
      this.getBuySaleItem(v, buyDate, saleDate);
    })
    const res = { buyDate, saleDate }
    this.saveBuySaleAutoData(JSON.stringify(res));
    return res;
  }
  /**
   * 按条件过滤
   * 增长率：
   *  近3年>90%
   *  近2年>60%
   *  近1年>30%
   */
  async findData() {
    const file = path.resolve(__dirname, `../data/list_${moment().format('YYYYMMDD')}.json`);
    if (fs.existsSync(file)) {
      const str = fs.readFileSync(file).toString();
      const list = JSON.parse(str);
      return {list, count: list.length};
    }
    const header = [
      '代码', '简称', '条码', '日期',
      '单位净值', '累计净值', '日增长率', '近1周', '近1月', '近3月', '近半年', '近1年', '近2年', '近3年',
      '今年来', '成立来', '其他1', '其他2', '其他3', '其他4', '其他5', '其他6', '其他7', '其他8', '其他9',
    ];
    const {sc = '3nzf', st = 'desc', sd = '2021-04-01', ed = '2021-04-30', pn = 30, dx = 1, pi = 1} = this.ctx.query;
    const ftArr = ['gp', 'hh', 'zq', 'zs', 'qdii', 'lof', 'fof'];
    const promisArr = ftArr.map((ft) => {
      return this.ctx.service.fundEastmoney.getList(ft, sc, st, sd, ed, pn, dx, pi);
    });
    const res = await Promise.all(promisArr);
    const l3yInfo = {
      index: header.indexOf('近3年'),
      min: 100,
    };
    const l2yInfo = {
      index: header.indexOf('近2年'),
      min: 60,
    };
    const l1yInfo = {
      index: header.indexOf('近1年'),
      min: 30,
    };
    const l6mInfo = {
      index: header.indexOf('近半年'),
      min: 10,
    };
    const l3mInfo = {
      index: header.indexOf('近3月'),
      min: 0,
    };
    const l1mInfo = {
      index: header.indexOf('近1月'),
      min: 0,
    };
    const l1wInfo = {
      index: header.indexOf('近1周'),
      min: 0,
    };
    const l1dInfo = {
      index: header.indexOf('日增长率'),
      min: 0,
    };
    const arrRes = [];
    const objRes = {};
    res.forEach((obj) => {
      if (obj && obj.datas) {
        obj.datas.forEach((item) => {
          item = item.split(',');
          if (
            parseFloat(item[l3yInfo.index]) > l3yInfo.min && 
            parseFloat(item[l2yInfo.index]) > l2yInfo.min && 
            parseFloat(item[l1yInfo.index]) > l1yInfo.min
            //  && 
            // parseFloat(item[l6mInfo.index]) > l6mInfo.min && 
            // parseFloat(item[l3mInfo.index]) > l3mInfo.min && 
            // parseFloat(item[l1mInfo.index]) > l1mInfo.min && 
            // parseFloat(item[l1wInfo.index]) > l1wInfo.min && 
            // parseFloat(item[l1dInfo.index]) < l1dInfo.min
          ) {
            objRes[item[0]] = item;
          }
        });
      } 
    });
    arrRes.push(...Object.values(objRes));
    this.saveListData(JSON.stringify(arrRes));
    return {list: arrRes, count: arrRes.length};
  }
  /**
   * 按条件过滤
   * 增长率：
   *  近3年>90%
   *  近2年>60%
   *  近1年>30%
   */
  async getGraphData(codes) {
    const file = path.resolve(__dirname, `../data/graph_${moment().format('YYYYMMDD')}.json`);
    if (fs.existsSync(file)) {
      const str = fs.readFileSync(file).toString();
      const list = JSON.parse(str);
      return list;
    }
    const lastYearDate = moment().subtract(1, 'years').format('YYYY-MM-DD');
    // const promisArr = codes.map((v) => {
    //   return this.getRangeMinMax(v, lastYearDate);
    // });
    // const graphArr = await Promise.all(promisArr);
    const graphArr = [];
    for(let i = 0; i < codes.length; i ++) {
      graphArr.push(await this.getRangeMinMax(codes[i], lastYearDate));
    }
    // 图表最高最低点数据
    this.saveGraphData(JSON.stringify(graphArr));
    return graphArr;
  }
  async getRangeMinMax(code, startDate, endDate = '') {
    const today = moment();
    if (! endDate) {
      endDate = today.format('YYYY-MM-DD');
    }
    const ago1m = moment().subtract(1, 'months').format('YYYY-MM-DD');
    const ago3m = moment().subtract(3, 'months').format('YYYY-MM-DD');
    const ago6m = moment().subtract(6, 'months').format('YYYY-MM-DD');
    const ago1y = moment().subtract(1, 'years').format('YYYY-MM-DD');
    let obj1m = {minUnitNet: 0, minAccumulatedNet: 0, maxUnitNet: 0, maxAccumulatedNet: 0};
    let obj3m = null;
    let obj6m = null;
    let obj1y = null;
    let currUnitNet = 0;
    let currAccumulatedNet = 0;
    let currDate = '';
    let currMonth = today;
    let sDate = currMonth.subtract(1, 'months').format('YYYY-MM-DD');
    let eDate = endDate;
    let monthAgoNum = 0;
    while(true) {
      if (monthAgoNum > 0) {
        eDate = sDate;
        currMonth = currMonth.subtract(monthAgoNum, 'months');
        sDate = currMonth.format('YYYY-MM-DD');
        if (moment(eDate).isBefore(startDate)) {
          break;
        }
      }
      const res = await this.ctx.service.fundEastmoney.getDailyData(code, sDate, eDate);
      if (currUnitNet === 0 && monthAgoNum === 0) {
        const currData = res[0];
        if (currData) {
          currUnitNet = parseFloat(currData.unitNet);
          currAccumulatedNet = parseFloat(currData.accumulatedNet);
          currDate = currData.date;
        }
      }
      for (let i = 0; i < res.length; i++) {
        const v = res[i];
        const unitNet = parseFloat(v.unitNet);
        const accumulatedNet = parseFloat(v.accumulatedNet);
        if (v.date > ago1m) {
          this.validateMinMax(obj1m, unitNet, accumulatedNet, v.date);
        } else if (v.date > ago3m) {
          if (obj3m === null) {
            obj3m = _.clone(obj1m);
          }
          if (obj3m === null) {
            console.log(code);
          }
          this.validateMinMax(obj3m, unitNet, accumulatedNet, v.date);
        } else if (v.date > ago6m) {
          if (obj6m === null) {
            obj6m = _.clone(obj3m);
          }
          if (obj6m === null) {
            console.log(code);
          }
          this.validateMinMax(obj6m, unitNet, accumulatedNet, v.date);
        } else if (v.date > ago1y) {
          if (obj1y === null) {
            obj1y = _.clone(obj6m);
          }
          if (obj1y === null) {
            console.log(code);
          }
          this.validateMinMax(obj1y, unitNet, accumulatedNet, v.date);
        }
      }
      monthAgoNum = 1;
    }
    return {code, obj1m, obj3m, obj6m, obj1y, currUnitNet, currAccumulatedNet, currDate};
  }
  validateMinMax(obj, unitNet, accumulatedNet, date) {
    if (obj.minUnitNet === 0 || obj.minUnitNet > unitNet) {
      obj.minUnitNet = unitNet;
      obj.minUnitNetDate = date;
    }
    if (obj.minAccumulatedNet === 0 || obj.minAccumulatedNet > accumulatedNet) {
      obj.minAccumulatedNet = accumulatedNet;
      obj.minAccumulatedNetDate = date;
    }
    if (obj.maxUnitNet < unitNet) {
      obj.maxUnitNet = unitNet;
      obj.maxUnitNetDate = date;
    }
    if (obj.maxAccumulatedNet < accumulatedNet) {
      obj.maxAccumulatedNet = accumulatedNet;
      obj.maxAccumulatedNetDate = date;
    }
  }
  getBuySaleItem(v, objBuy, objSale, startPercent = 0.1, endPercent = 0.8) {
    const { obj1m, obj3m, obj6m, obj1y } = v;
    function itemFn(v, obj, arr1, arr2) {
      const { currUnitNet } = v;
      const diffVal = obj.maxUnitNet - obj.minUnitNet;
      const startVal = obj.minUnitNet + diffVal * startPercent;
      const endVal = obj.minUnitNet + diffVal * endPercent;
      if (currUnitNet < startVal && currUnitNet > obj.minUnitNet) {
        arr1.push({..._.pick(v, ['code', 'currDate', 'currUnitNet']), startVal, endVal});
      }
      if (currUnitNet > endVal && currUnitNet < obj.maxUnitNet) {
        arr2.push({..._.pick(v, ['code', 'currDate', 'currUnitNet']), startVal, endVal});
      }
    }
    if (obj1m) itemFn(v, obj1m, objBuy.buy1m, objSale.sale1m);
    if (obj3m) itemFn(v, obj3m, objBuy.buy3m, objSale.sale3m);
    if (obj6m) itemFn(v, obj6m, objBuy.buy6m, objSale.sale6m);
    if (obj1y) itemFn(v, obj1y, objBuy.buy1y, objSale.sale1y);
  }
  saveListData(str) {
    const file = path.resolve(__dirname, `../data/list_${moment().format('YYYYMMDD')}.json`);
    fs.writeFile(file, str, (e) => {
      if (e) {
        console.log(e);
      }
    })
  }
  saveGraphData(str) {
    const file = path.resolve(__dirname, `../data/graph_${moment().format('YYYYMMDD')}.json`);
    fs.writeFile(file, str, (e) => {
      if (e) {
        console.log(e);
      }
    })
  }
  saveBuySaleAutoData(str) {
    const file = path.resolve(__dirname, `../data/busa_${moment().format('YYYYMMDD')}.json`);
    fs.writeFile(file, str, (e) => {
      if (e) {
        console.log(e);
      }
    })
  }
}
module.exports = HomeController;
