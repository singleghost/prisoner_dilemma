
//引用express
var express = require('express');

//引用express-handlebars模板引擎
var hbs = require('express-handlebars').create({
    defaultLayout: 'main', //默认布局模板为main.hbs
    extname: '.hbs'         //设置文件后缀名为.hbs
});
var body_parser = require('body-parser')

var app = express();
app.use(body_parser.json())
app.use(body_parser.urlencoded({ extended: false }))
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.set('port', process.env.PORT || 3000);   //设置端口

//设置模板引擎为express-handlebars
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

//使用static中间件 制定public目录为静态资源目录,其中资源不会经过任何处理
app.use(express.static(__dirname + '/public'));

//home页路由
app.get('/', function (req, res) {
    res.render('home', {
        title: 'Home Page'    //传入页面的title
    });
});

app.post('/post_strategy', function (req, res) {
    console.log(req.body.code)
    js_strategy_code = req.body.code
    var strategy_pool = battle(js_strategy_code)
    console.log(strategy_pool)
    var result = ""
    for (let i = 0; i < strategy_pool.length; i++) {
        result += (`${i}. ${strategy_pool[i].name} ${strategy_pool[i].score}分</br>`)
    }
    res.end(result)
})

//about页路由
app.get('/about', function (req, res) {
    res.render('about', {
        title: 'About Page'    //传入页面的title
    });
});

app.listen(app.get('port'), function () {
    console.log('服务器启动完成，端口为： ' + app.get('port'));
});

function battle(js_strategy_code) {
    //这是一个试验多轮博弈的囚徒困境的小游戏

    //代码规范
    //所有的字符串都是双引号，尽量使用===而不是==

    //定义一些游戏的常量
    //游戏规则，玩家可以编写一个策略参与比赛，和内置的其他策略进行比拼，每一个策略都要和所有其他策略(包括自己)各比赛一场
    //每一场比赛都有200轮，在每一轮中玩家可以选择背叛或者合作，根据自己的出牌和对手的出牌获取对应的分数，最后计算所有比赛场次的总分，
    //得分高的胜出
    const rounds = 200
    const teamwork_score = 3;
    const be_betrayed_score = 0;
    const betray_score = 5;
    const betray_each_other_score = 1;
    const coop = 1
    const betray = 0
    const log_process = false; //是否详细输出每一场比赛的每一轮的出牌情况
    //我是裁判
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function* strategy_always_coop() {
        //永远合作策略
        for (let i = 0; i < rounds; i++) {
            var peer_card = yield coop
        }
    }

    function* strategy_always_betray() {
        //永远背叛策略
        for (let i = 0; i < rounds; i++) {
            var peer_card = yield betray;
        }
    }


    function* strategy_tit_or_tat() {
        //针锋相对策略
        //第一回合采取合作策略，之后的每一回合，只是简单的复制对手上一回合的策略
        var peer_card = yield coop
        for (let i = 0; i < rounds - 1; i++) {
            peer_card = yield peer_card
        }
    }

    function* strategy_native_prober() {
        //老实人探测器策略
        //在每十步中任意选择一步，打出恶意的背叛牌
        //如果不打出背叛牌，采取的便是针锋相对策略
        betray_period = 10;
        betray_rounds = []; //采取背叛策略的回合
        for (let j = 0; j < rounds; j += 10) {
            if (j == 0) {
                betray_rounds.push(getRandomInt(1, 9)); //第一回合肯定是合作的啦
            } else {
                betray_rounds.push(getRandomInt(j, j + 9))//其余的时间每十个回合中选一个回合背叛
            }
        }
        var peer_card = yield coop;
        for (let i = 1; i < rounds; i++) {
            if (betray_rounds.includes(i)) {
                //随机的背叛一把，嘻嘻
                peer_card = yield betray
            } else {
                peer_card = yield peer_card
            }
        }
    }


    function* strategy_renwrseful_prober() {
        //愧疚探测器策略
        //以老实人探测器策略为基础
        //但是会记住自己上一轮打出的背叛牌是主动背叛还是仅仅为了报复
        //如果是前者，那么在下一轮“愧疚地”让对手得到反击的机会，即打出合作牌
        betray_period = 10;
        betray_rounds = []; //采取背叛策略的回合
        for (let j = 0; j < rounds; j += 10) {
            if (j == 0) {
                betray_rounds.push(getRandomInt(1, 9)); //第一回合肯定是合作的啦
            } else {
                betray_rounds.push(getRandomInt(j, j + 9))//其余的时间每十个回合中选一个回合背叛
            }
        }
        // console.log("愧疚探测器采取随机背叛的回合有" + betray_rounds)
        var peer_card = yield coop;
        var rdm_betray_on_last_round = false
        for (let i = 1; i < rounds; i++) {
            if (rdm_betray_on_last_round === true) {
                peer_card = yield coop
                rdm_betray_on_last_round = false
            } else if (betray_rounds.includes(i)) {
                //随机的背叛一把，嘻嘻
                peer_card = yield betray
                rdm_betray_on_last_round = true
            } else {
                peer_card = yield peer_card
                rdm_betray_on_last_round = false
            }
        }
    }

    class Player {
        constructor(strategy_func, strategy_name) {
            this.strategy = strategy_func
            this.name = strategy_name
            this.score = 0
        }
    }
    //策略池
    strategy_pool = []
    strategy_pool.push(new Player(strategy_always_betray, "总是背叛策略"))
    strategy_pool.push(new Player(strategy_always_coop, "总是合作策略"))
    strategy_pool.push(new Player(strategy_native_prober, "老实人探测器策略"))
    strategy_pool.push(new Player(strategy_tit_or_tat, "针锋相对策略"))
    strategy_pool.push(new Player(strategy_renwrseful_prober, "愧疚探测器策略"))

    //玩家提交的策略
    // function* strategy_from_player() {
    //     //完全随机策略
    //     for (let i = 0; i < rounds; i++) {
    //         yield getRandomInt(0, 1)
    //     }
    // }
    strategy_pool.push(new Player(eval(js_strategy_code), "玩家策略"))


    //策略池中的每一个策略都要和其他的所有策略(包括自己)比赛一场
    for (let i = 0; i < strategy_pool.length; i++) {
        for (let j = 0; j < strategy_pool.length; j++) {
            var player_first = strategy_pool[i].strategy()
            var player_second = strategy_pool[j].strategy()
            var p_first_tot_score = 0;
            var p_sec_tot_score = 0;

            last_second_card = undefined
            last_first_card = undefined

            p_first_history = []
            p_sec_history = []
            for (let i = 0; i < rounds; i++) {
                p_first_card = player_first.next(last_second_card).value
                p_sec_card = player_second.next(last_first_card).value
                last_second_card = p_sec_card
                last_first_card = p_first_card
                p_first_history.push(p_first_card)
                p_sec_history.push(p_sec_card)
                if (p_first_card === coop && p_sec_card === coop) {
                    p_first_tot_score += teamwork_score
                    p_sec_tot_score += teamwork_score
                } else if (p_first_card === coop && p_sec_card === betray) {
                    p_first_tot_score += be_betrayed_score
                    p_sec_tot_score += betray_score
                } else if (p_first_card === betray && p_sec_card === coop) {
                    p_first_tot_score += betray_score
                    p_sec_tot_score += be_betrayed_score
                } else if (p_first_card === betray && p_sec_card === betray) {
                    p_first_tot_score += betray_each_other_score
                    p_sec_tot_score += betray_each_other_score
                }

            }
            strategy_pool[i].score += p_first_tot_score
            strategy_pool[j].score += p_sec_tot_score
            if (log_process) {
                for (let j = 0; j < rounds; j += 10) {

                    columns = ""
                    for (let i = j; i < j + 10; i++) {
                        columns += i.toString() + "\t"
                    }
                    console.log("round   \t" + columns)
                    console.log("player 1\t" + p_first_history.slice(j, j + 10).map(x => x.toString() + "\t").join(""))
                    console.log("player 2\t" + p_sec_history.slice(j, j + 10).map(x => x + "\t").join(""))
                    console.log("\n")
                }
            }
            console.log(`${strategy_pool[i].name}\t vs. ${strategy_pool[j].name}`)
            console.log(`${p_first_tot_score}\t vs. ${p_sec_tot_score}`)
            console.log("\n")
        }
    }

    console.log("下面公布最终得分情况")
    strategy_pool.sort((a, b) => {
        return b.score - a.score
    })
    for (let i = 0; i < strategy_pool.length; i++) {
        console.log(`${i}. ${strategy_pool[i].name} ${strategy_pool[i].score}分`)
    }
    return strategy_pool
}