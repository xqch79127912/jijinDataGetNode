# jijinDataGetNode
node-egg爬虫实践

## 订单数据
order_{YYYY}.js
## 分组（1月，3月，6月，1年）数据
graph_{YYYYMMDD}.js

## 买卖参考数据
busa_{YYYYMMWW}.js

## 原始数据
list_{YYYYMMDD}.js

data.obj1m.closeOrders.forEach((v) => {
    const {createTime, closeTime} = v;
    const date1=new Date(createTime.substr(0, 4), createTime.substr(4, 2), createTime.substr(6, 2));
    const date2=new Date(closeTime.substr(0, 4), closeTime.substr(4, 2), closeTime.substr(6, 2));
    const date= Number((date2.getTime() - date1.getTime()) / (1000*60*60*24));
    console.log(`${v.code}-${Number(v.closeTime) - Number(v.createTime)} days-${Math.round((v.salePrice - v.buyPrice) * 100/v.buyPrice)}%`)
})