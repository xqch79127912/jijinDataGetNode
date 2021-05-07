const Service = require('egg').Service;
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const moment = require('moment');

class FundEastmoney extends Service {
  /**
   * 获取所有基金代码
   * @returns
   */
  async getAllCodes() {
    const { ctx, config } = this;
    const { serverUrl } = config.fundEastmoney;
    const url = `${serverUrl}/allfund.html`;
    const res = await ctx.curl(url, {});
    const coding = 'gb2312';
    const body = iconv.decode(res.data, coding);
    const $ = cheerio.load(`<body>${body}</body>`);
    const fundCodesArray = [];
    $('body').find('.num_right').find('li').each((i, item)=>{
      const codeItem = $(item);
      const codeAndName = $(codeItem.find('a')[0]).text();
      const codeAndNameArr = codeAndName.split('）');
      const code = codeAndNameArr[0].substr(1);
      const fundName = codeAndNameArr[1];
      if(code){
        fundCodesArray.push(code);
      }
    });
    return fundCodesArray;
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
  async getList(ft, sc, st, sd, ed, pn, dx, pi) {
    const { ctx, config } = this;
    const { serverUrl } = config.fundEastmoney;
    const params = `op=ph&dt=kf&ft=${ft}&rs=&gs=0&sc=${sc}&st=${st}&sd=${sd}&ed=${ed}&qdii=&tabSubtype=,,,,,&pi=${pi}&pn=${pn}&dx=${dx}&v=0.2692835962833908`;
    const url = `${serverUrl}/data/rankhandler.aspx?${params}`;
    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36',
      'referer': `${serverUrl}/data/fundranking.html`,
      'cookie': this.getCookisStr(),
    };
    const res = await ctx.curl(url, {headers, timeout: 20000});
    let rankData = '1';
    eval(res.data.toString().replace('var ', ''));
    return rankData; 
  }
  /**
   * 根据基金代码获取其选定日期范围内的基金数据
   * @param {string} code 基金代码
   * @param {string} startDate 开始日期
   * @param {string} endDate 截止日期
   * @param {number} per 数据个数
   */
  async getDailyData(code, startDate, endDate, per = 999) {
    const { ctx, config } = this;
    const { host } = config.fundEastmoney;
    const params = `type=lsjz&code=${code}&sdate=${startDate}&edate=${endDate}&per=${per}`;
    const url = `${host}/F10DataApi.aspx?${params}`;
    console.log(url);
    const res = await ctx.curl(url, {method: 'GET', timeout: 100000});
    const coding = 'gb2312';
    const body = iconv.decode(res.data, coding);
    const $ = cheerio.load(`<body>${body}</body>`);
    const table = $('body').find('table');
    const tbody = table.find('tbody');
    const fundData = [];
    try{
      tbody.find('tr').each((i,trItem)=>{
        let fundItem = {};
        const tdArray = $(trItem).find('td').map((j, tdItem)=>{
          return $(tdItem);
        });
        fundItem.date = tdArray[0].text(); // 净值日期
        fundItem.unitNet = tdArray[1].text(); // 单位净值
        fundItem.accumulatedNet = tdArray[2].text(); // 累计净值
        fundItem.changePercent  = tdArray[3].text(); // 日增长率
        fundData.push(fundItem);
      });
    } catch (e) {
      console.log(e);
      throw new Error(e);
    }
    return fundData;
  }
  /**
   * 基金基本信息
   * @param {string} code 基金代码
   */
  async getInfo(code) {
    const { ctx, config } = this;
    const { host } = config.fundEastmoney;
    const url = `${host}/${code}.html`;
    console.log(url);
    const headers = {
      'Host': 'fundf10.eastmoney.com',
    };
    const res = await ctx.curl(url, { method: 'GET', headers });
    const body = res.data;
    const $ = cheerio.load(`<body>${body}</body>`);
    let fundData = {fundCode: code};
    let dataRow = $('body').find('.detail .box').find('tr');
    fundData.fundName = $($(dataRow[0]).find('td')[0]).text(); // 基金全称
    fundData.fundNameShort = $($(dataRow[0]).find('td')[1]).text(); // 基金简称
    fundData.fundType = $($(dataRow[1]).find('td')[1]).text(); // 基金类型
    fundData.releaseDate = $($(dataRow[2]).find('td')[0]).text(); // 发行日期
    fundData.buildDate = $($(dataRow[2]).find('td')[1]).text(); // 成立日期/规模
    fundData.assetScale = $($(dataRow[3]).find('td')[0]).text(); // 资产规模
    fundData.shareScale = $($(dataRow[3]).find('td')[1]).text(); // 份额规模
    fundData.administrator = $($(dataRow[4]).find('td')[0]).text(); // 基金管理人
    fundData.custodian = $($(dataRow[4]).find('td')[1]).text(); // 基金托管人
    fundData.manager = $($(dataRow[5]).find('td')[0]).text(); // 基金经理人
    fundData.bonus = $($(dataRow[5]).find('td')[1]).text(); // 分红
    fundData.managementRate = $($(dataRow[6]).find('td')[0]).text(); // 管理费率
    fundData. trusteeshipRate = $($(dataRow[6]).find('td')[1]).text(); // 托管费率
    fundData.saleServiceRate = $($(dataRow[7]).find('td')[0]).text(); // 销售服务费率
    fundData.subscriptionRate = $($(dataRow[7]).find('td')[1]).text(); // 最高认购费率
    return fundData;
  }
  getCookisStr() {
    const arr = [
      `st_si=${moment().format('GG')}${moment().format('x')}`,
      'st_asi=delete',
      'ASP.NET_SessionId=gekyucnll0wte0wrks2rr23b7',
      '_adsame_fullscreen_18503=1',
      'EMFUND1=null',
      'EMFUND2=null',
      'EMFUND3=null',
      'EMFUND4=null',
      'EMFUND5=null',
      'EMFUND6=null',
      'EMFUND7=null',
      'EMFUND8=null',
      'EMFUND0=null',
      `EMFUND9=${moment().format('MM-DD')} ${moment().format('HH-mm-ss')}@#$%u521B%u91D1%u5408%u4FE1%u5DE5%u4E1A%u5468%u671F%u80A1%u7968A@%23%24005968`,
      'st_pvi=90009717841707',
      `st_sp=${moment().format('YYYY-MM-DD')}%2012%3A14%3A29`,
      'st_inirUrl=https%3A%2F%2Fwww.baidu.com%2Flink',
      'st_sn=21',
      `st_psi=${moment().format('YYYYMMDDwwDDDDHHmm-d-X')}`,
    ];
    return arr.join(';');
  }
}

module.exports = FundEastmoney;