const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if(fs.statSync(dirPath).isDirectory()) {
       walk(dirPath, callback);
    } else {
       callback(dirPath);
    }
  });
}

walk(path.join(process.cwd(), 'src', 'app', 'pages'), (filePath) => {
  if (filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    let original = content;
    
    content = content.replace(/const \[notifications, setNotifications\] = useState\(\d+\);/g, 'const [notifications, setNotifications] = useState(0);');
    content = content.replace(/const \[notificationList, setNotificationList\] = useState\(adminNotifications\);/g, 'const [notificationList, setNotificationList] = useState([]);');
    content = content.replace(/const \[notificationList, setNotificationList\] = useState\(teacherNotifications\);/g, 'const [notificationList, setNotificationList] = useState([]);');
    content = content.replace(/import \{.*?Notifications\} from ".*?NotificationDefault";\n?/g, '');
    
    if (original !== content) {
      fs.writeFileSync(filePath, content);
      console.log('Updated: ' + filePath);
    }
  }
});
