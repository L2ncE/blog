---
title: GORM 快速入门最佳实践（含有样例数据库）
date: 2022-04-24
taxonomies:
  categories: ["Golang"]
  tags: ["Go", "Golang", "gorm", "数据库"]
---

在听完金柱老师对 GORM 的讲解后，我对于 GORM 的理解更深一层，又回忆到学习 GORM 时网络上基本没有带样例数据库的教程，所以在今天带着样例数据库写一篇GORM的简单入门教程（基础使用）
>我所展示的实现效果与代码可能会有一定出入，这是因为我展示中的数据库模型更加完善但不适合教程使用，但是不妨碍学习

## 数据库建立

在使用 GORM 之前我们需要把样例数据库先创建好，我一般不用 GORM 的建库方法，更常用手动建库。因为我们是基础使用，所以数据库也并不复杂，即一个简单的选课系统数据库。

### 课程表

```sql
CREATE TABLE `course`
(
    `Id`     bigint(20)  NOT NULL AUTO_INCREMENT,
    `Name`   varchar(20) NOT NULL,
    `Credit` float       NOT NULL,
    PRIMARY KEY (`Id`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  DEFAULT CHARSET = utf8mb4
```

### 专业表

```sql
CREATE TABLE `major`
(
    `MajorNum`  bigint(20)  NOT NULL,
    `MajorName` varchar(20) NOT NULL,
    PRIMARY KEY (`MajorNum`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
```

### 学生表

```sql
CREATE TABLE `student`
(
    `Id`       bigint(20)  NOT NULL AUTO_INCREMENT,
    `Name`     varchar(10) NOT NULL,
    `Password` varchar(20) DEFAULT NULL,
    `MajorNum` bigint(20)  DEFAULT NULL,
    `Identity` tinyint(4)  DEFAULT '1',
    `Credit`   float       DEFAULT '0',
    PRIMARY KEY (`Id`),
    KEY `MajorNum` (`MajorNum`),
    CONSTRAINT `student_ibfk_1` FOREIGN KEY (`MajorNum`) REFERENCES `major` (`MajorNum`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  DEFAULT CHARSET = utf8mb4
```

### 学生课程表

```sql
CREATE TABLE `stu_course`
(
    `Id`         bigint(20) NOT NULL AUTO_INCREMENT,
    `StudentNum` bigint(20) NOT NULL,
    `TCourseNum` bigint(20) NOT NULL,
    `Grade`      varchar(10) DEFAULT '暂未上传',
    `Time`       varchar(20) DEFAULT NULL,
    PRIMARY KEY (`Id`),
    KEY `StudentNum` (`StudentNum`),
    KEY `stu_course_ibfk_2` (`TCourseNum`),
    CONSTRAINT `stu_course_ibfk_1` FOREIGN KEY (`StudentNum`) REFERENCES `student` (`Id`),
    CONSTRAINT `stu_course_ibfk_2` FOREIGN KEY (`TCourseNum`) REFERENCES `t_course` (`Id`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  DEFAULT CHARSET = utf8mb4
```

### 老师表

```sql
CREATE TABLE `teacher`
(
    `Id`       bigint(20)  NOT NULL AUTO_INCREMENT,
    `Name`     varchar(10) NOT NULL,
    `Password` varchar(20) NOT NULL,
    `Identity` tinyint(4)  DEFAULT '2',
    PRIMARY KEY (`Id`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  DEFAULT CHARSET = utf8mb4
```

### 老师课程表

```sql
CREATE TABLE `t_course`
(
    `Id`         bigint(20) NOT NULL AUTO_INCREMENT,
    `CourseNum`  bigint(20) NOT NULL,
    `TeacherNum` bigint(20) NOT NULL,
    `Time`       varchar(255) DEFAULT NULL,
    `Num`        int(11)      DEFAULT '0',
    `Total`      int(11)      DEFAULT NULL,
    PRIMARY KEY (`Id`),
    KEY `CourseNum` (`CourseNum`),
    KEY `TeacherNum` (`TeacherNum`),
    CONSTRAINT `t_course_ibfk_1` FOREIGN KEY (`CourseNum`) REFERENCES `course` (`Id`),
    CONSTRAINT `t_course_ibfk_2` FOREIGN KEY (`TeacherNum`) REFERENCES `teacher` (`Id`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  DEFAULT CHARSET = utf8mb4
```

这个数据库建的非常基础，也没有太多的高级操作，所以也不需要一一介绍了，大家可以直接在本地复制代码到终端建表。

## GORM 的简单使用

### GORM 的连接

```go
var db *gorm.DB

func InitGormDB() (err error) {
   dB, err := gorm.Open(mysql.New(mysql.Config{
      DSN: fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
         global.Settings.GormInfo.Name, global.Settings.GormInfo.Password, global.Settings.GormInfo.Host, global.Settings.GormInfo.Port, global.Settings.GormInfo.DBName), // DSN data source name
      DefaultStringSize:        171,
      DisableDatetimePrecision: true,
      DontSupportRenameIndex:   true,
   }), &gorm.Config{
      SkipDefaultTransaction:                   false,
      DisableForeignKeyConstraintWhenMigrating: true,
      NamingStrategy: schema.NamingStrategy{
         SingularTable: true,
      },
   })
   if err != nil {
      fmt.Printf("连接失败：%v\n", err)
   }
   db = dB
   return err
}
```
其中使用的非常多的配置，由于配置数量太多，建议大家到官方文档或源码中进行进一步的了解。

这里再把 [GORM的中文文档](https://gorm.io/zh_CN/docs/) 放出来，大家如果在接下来有什么没看懂的地方建议去中文文档中仔细阅读。

因为我们只是简单的使用教程，所以我们就不以表为单位来进行讲解，而是以 GORM 的功能使用为单位。

所谓**常用**，增删改查肯定是必不可少的，我们现在就从增删改查开始说起。

### 数据的增加（插入）

我们直接以学生为例，学生在注册好之后需要将数据放入数据库中，所以我们在 `data access object` 层中(也可以叫其他层)中进行 GORM 的插入操作。

```go
func InsertStu(user model.Student) error {
   deres := db.Select("Name", "Password", "MajorNum").Create(&model.Student{Name: user.Name, Password: user.Password, MajorNum: user.MajorNum})
   err := deres.Error
   if err != nil {
      fmt.Printf("insert failed, err:%v\n", err)
      return err
   }
   return err
}
```
值得一提的是 `model.Student` 为学生的相关模型，模型的建立依照上面的数据库建立规范实现，但是 GORM 本身会有非常多的配置，所以你在编写模型层的时候要注意 `gorm` 标签的使用。

**一个例子**
```go
type Student2TInfo struct {
   Id       int
   Name     string
   MajorNum int `gorm:"column:MajorNum"` //自定义列名
}

//自定义表名
func (Student2TInfo) TableName() string {
   return "student"
}
```

回到正题，我们在 main 函数中插入数据并调用 `InsertStu` 后，数据库中就会产生这一条数据。

### 数据的删除

删除非常的简单也没什么需要细说的地方。

下面的例子是删除老师的课程。

```go
func DeleteTCourse(id int) error {
   var Course []model.TCourse
   dbRes := db.Where("Id = ?", id).Delete(&Course)
   err := dbRes.Error
   if err != nil {
      fmt.Printf("delete failed, err:%v\n", err)
      return err
   }
   return err
}
```
其中 `model.TCourse` 可以参考上面数据库的设计。

### 数据的更改

下面的例子是更改学生的密码

```go
func UpdateStuPassword(id int, newPassword string) error {
   deRes := db.Model(&model.Student{}).Where("Id = ?", id).Update("Password", newPassword)
   err := deRes.Error
   if err != nil {
      fmt.Printf("update failed, err:%v\n", err)
      return err
   }
   return err
}
```

### 数据的查询

下面的例子是通过学生的 ID 查询密保的问题。

```go
func SelectQuestionByStuId(id int) string {
   user := model.Student{}
   db.Model(&model.Student{}).Select("question").Where("Id = ?", id).Find(&user)
   return user.Question
}
```

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d47700b86eb.png)

***
至此增删改查功能基本实现就到此为止，接下来我们一起来看看更加高级的操作。

### 数据的一对多，多对多...

我们直接上代码
```go
func SelectStuCourse(id int) ([]model.StuCourseInfo, error) {
   var Course []model.StuCourseInfo
   dbRes := db.Debug().Where("StudentNum = ?", id).Preload("TCourseInfo").Preload("TCourseInfo.CourseInfo").Preload("TCourseInfo.TeacherInfo").Find(&Course)
   err := dbRes.Error
   return Course, err
}
```
首先，这是通过 ID 查询学生选课信息的函数。

这个函数中最主要的就是使用了 `Preload` 预加载，我们Postman 上看看效果。


![image.png](https://picture.lanlance.cn/i/2023/08/10/64d4771522ede.png)


![image.png](https://picture.lanlance.cn/i/2023/08/10/64d4772359a02.png)
会一个接一个的响应出来，而这样一对多的实现方法就是 `gorm` 中的 `preload` 预加载。

代码和效果都看完了，我们现在来看看他的模型是怎么样的，是如何设计才能程序这样的效果呢，这里我们把这个实现的所有模型都给到。

```go
type StuCourseInfo struct {
   TCourseNum  int `gorm:"column:TCourseNum"`
   Grade       string
   Time        string
   TCourseInfo []TCourseInfo `gorm:"foreignKey:Id;references:TCourseNum"`
}


func (StuCourseInfo) TableName() string {
   return "stu_course"
}


type TCourseInfo struct {
   Id          int
   CourseNum   int `gorm:"column:CourseNum"`
   TeacherNum  int `gorm:"column:TeacherNum"`
   Num         int
   CourseInfo  Course       `gorm:"foreignKey:Id;references:CourseNum"`
   TeacherInfo TeacherInfo2 `gorm:"foreignKey:Id;references:TeacherNum"`
}


func (TCourseInfo) TableName() string {
   return "t_course"
}


type TeacherInfo2 struct {
   Id   int
   Name string
}

func (TeacherInfo2) TableName() string {
   return "teacher"
}


type Course struct {
   Id     int
   Name   string
   Credit float64
}

```
通过这几个模型就可以使用 `preload` 预加载实现一对多，多对多，只要我们将标签中的外键约束确立好就可以轻松实现。

### 事务的实现

使用了 `ORM` 那哪能不用到事务呢，直接上代码

```go
func InsertStuCourse(course model.StuCourse, credit float64) error {
   stu := model.Student{}
   err := db.Transaction(func(tx *gorm.DB) error {
      if err := tx.Select("StudentNum", "TCourseNum", "Time").Create(&model.StuCourse{StudentNum: course.StudentNum, TCourseNum: course.TCourseNum, Time: course.Time}).Error; err != nil {
         return err
      }
      if err := tx.Model(&model.TCourse{}).Where("id = ?", course.TCourseNum).Update("Num", gorm.Expr("Num + 1")).Error; err != nil {
         return err
      }
      if err := tx.Model(&model.Student{}).Where("id = ?", course.StudentNum).Update("Credit", gorm.Expr("Credit + ?", credit)).Error; err != nil {
         return err
      }
      if err := tx.Model(&model.Student{}).Select("Credit").Where("id = ?", course.StudentNum).Find(&stu).Error; err != nil {
         return err
      }
      fmt.Println(stu.Credit)
      if stu.Credit >= 28 {
         tx.Rollback()
      }
      return nil
   })
   if err != nil {
      fmt.Printf("insert failed, err:%v\n", err)
      return err
   }
   return err
}
```
这个事务调用后能够实现学生选课，除此之外还会使那门课程的选课人数加一，学生选课总学分增加（防止超学分），使用了事务过后就能保证他的一致性，出错即回滚。

## 总结
以上则是`gorm`的简单使用，若有更多需求请去中文文档学习或查看源码，若有不懂的地方请留言，我看到了就会答复。

这是我的GitHub主页 [https://github.com/L2ncE](https://github.com/L2ncE)，欢迎 Follow、Star

