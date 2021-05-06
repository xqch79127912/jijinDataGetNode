const { Controller } = require('egg');

class HomeController extends Controller {
  async index() {
    this.ctx.body = 'Hello world';
    const res = await this.ctx.service.fundEastmoney.getDailyData('162411', '2021-01-01', '2021-05-01');
    // const res = await this.findData();
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
   * 增长率：
   *  近3年>90%
   *  近2年>60%
   *  近1年>30%
   */
  async findData() {
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
          if (parseFloat(item[l3yInfo.index]) > l3yInfo.min && 
          parseFloat(item[l2yInfo.index]) > l2yInfo.min && 
          parseFloat(item[l1yInfo.index]) > l1yInfo.min && 
          parseFloat(item[l6mInfo.index]) > l6mInfo.min && 
          parseFloat(item[l3mInfo.index]) > l3mInfo.min && 
          parseFloat(item[l1mInfo.index]) > l1mInfo.min && 
          parseFloat(item[l1wInfo.index]) > l1wInfo.min && 
          parseFloat(item[l1dInfo.index]) < l1dInfo.min) {
            objRes[item[0]] = item;
          }
        });
      } 
    });
    arrRes.push(...Object.values(objRes));
    return {list: arrRes, count: arrRes.length};
  }
}
module.exports = HomeController;
