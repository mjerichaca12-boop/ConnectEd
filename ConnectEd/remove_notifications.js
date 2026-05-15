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

walk('c:\\Users\\Jericha Mae Aguirre\\OneDrive\\Desktop\\CAPSTONE\\ConnectEd\\ConnectEd\\src\\app\\pages', (filePath) => {
  if (filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    let original = content;
    
    // Replace integer notifications
    content = content.replace(/const \[notifications, setNotifications\] = useState\(\d+\);/g, 'const [notifications, setNotifications] = useState(0);');
    
    // Replace admin notifications array
    content = content.replace(/const \[notificationList, setNotificationList\] = useState\(adminNotifications\);/g, 'const [notificationList, setNotificationList] = useState([]);');
    
    // Replace teacher notifications array
    content = content.replace(/const \[notificationList, setNotificationList\] = useState\(teacherNotifications\);/g, 'const [notificationList, setNotificationList] = useState([]);');
    
    // Remove imports
    content = content.replace(/import \{.*?Notifications\} from ".*?NotificationDefault";\n?/g, '');
    
    if (original !== content) {
      fs.writeFileSync(filePath, content);
      console.log('Updated: ' + filePath);
    }
  }
});
